use std::collections::VecDeque;

use chrono::{DateTime, Utc};
use futures::join;
use pixelbin_shared::Ignorable;
use serde::Deserialize;
use tracing::{debug, warn, Instrument};

use crate::{
    metadata::{alternates_for_media_file, METADATA_FILE},
    shared::json::FromDb,
    store::{
        db::{functions::from_row, Isolation},
        file::{DiskStore, FileStore},
        models,
        path::{CatalogStore, MediaFileStore, ResourceList, ResourcePath},
    },
    Result, Store, Task,
};

pub(super) async fn clean_queues(store: Store) -> Result {
    let mut conn = store.connect().await?;
    models::SavedSearch::clean_subscriptions(&mut conn).await
}

pub(super) async fn server_startup(store: Store) -> Result {
    let mut conn = store.connect().await?;
    let catalogs = conn.list_catalogs().await?;

    for catalog in catalogs {
        store
            .queue_task(Task::DeleteMedia {
                catalog: catalog.clone(),
            })
            .await;

        models::MediaItem::update_media_files(&mut conn, &catalog).await?;

        store
            .queue_task(Task::UpdateSearches {
                catalog: catalog.clone(),
            })
            .await;

        store
            .queue_task(Task::ProcessMedia {
                catalog: catalog.clone(),
            })
            .await;

        store.queue_task(Task::PruneMediaFiles { catalog }).await;

        store.queue_task(Task::CleanQueues).await;
    }

    Ok(())
}

pub(super) async fn update_searches(store: Store, catalog: &str) -> Result {
    let mut conn = store.connect().await?;
    models::SavedSearch::update_for_catalog(&mut conn, catalog).await
}

pub(super) async fn delete_alternate_files(store: Store, alternate_files: &[String]) -> Result {
    let mut conn = store.connect().await?;
    // TODO: Delete the files here.
    models::AlternateFile::delete(&mut conn, alternate_files).await?;

    Ok(())
}

async fn prune_storage<S: FileStore>(store: &S, root: &ResourcePath, list: ResourceList) -> Result {
    for (resource, _) in list {
        store.delete(&resource).await?;
    }

    store.prune(root).await
}

pub(super) async fn verify_storage(mut store: Store, catalog: &str, delete_files: bool) -> Result {
    let storage = models::Storage::get_for_catalog(&mut store, catalog).await?;

    let remote_store = storage.file_store(store.config()).await?;
    let local_store = DiskStore::local_store(store.config());
    let temp_store = DiskStore::temp_store(store.config());

    let resource = CatalogStore {
        catalog: catalog.to_owned(),
    };

    let (remote_files, local_files, temp_files) = join!(
        remote_store.list_files(Some(&resource)).in_current_span(),
        local_store.list_files(Some(&resource)).in_current_span(),
        temp_store.list_files(Some(&resource)).in_current_span()
    );

    let mut remote_files = remote_files?;
    let mut local_files = local_files?;
    let mut temp_files = temp_files?;

    let mut conn = store.pooled();
    let public_items = models::MediaItem::list_public(&mut conn, catalog).await?;

    for media_item_store in models::MediaItem::list_not_deleted(&mut conn, catalog).await? {
        let mut media_files_to_update: Vec<models::MediaFile> = Vec::new();
        let mut media_files_to_delete: Vec<String> = Vec::new();
        let mut alternates_to_update: Vec<models::AlternateFile> = Vec::new();
        let mut alternates_to_delete: Vec<String> = Vec::new();

        let _guard = store
            .locks()
            .media_item(&store, &media_item_store)
            .for_delete()
            .await;

        let mut media_files = VecDeque::<(models::MediaFile, MediaFileStore)>::from(
            models::MediaFile::list_for_item(&mut conn, &media_item_store.item).await?,
        );

        // Find the first valid media file (basically anything with either a local temporary copy
        // or the uploaded version).
        let mut valid_media_file: Option<models::MediaFile> = None;

        while let Some((mut media_file, media_file_store)) = media_files.pop_front() {
            let media_file_path = media_file_store.file(&media_file.file_name);

            let has_remote = media_file.stored.is_some()
                && remote_files.get(&media_file_path) == Some(media_file.file_size as u64);
            let has_local = temp_files.get(&media_file_path) == Some(media_file.file_size as u64);

            if !has_remote && !has_local {
                // This is a bad media file.
                debug!(
                    media_item = media_file.media_item,
                    media_file = media_file.id,
                    "Found a bad media file."
                );
                media_files_to_delete.push(media_file.id.clone());
                continue;
            }

            // This is ultimately the best MediaFile for this MediaItem. Make sure it has all
            // the right flags.
            let mut changed = false;
            remote_files.remove(&media_file_path);

            temp_files.remove(&media_file_path);

            if !has_remote && media_file.stored.is_some() {
                warn!(
                    media_item = media_file.media_item,
                    media_file = media_file.id,
                    "Remote file was lost."
                );
                changed = true;
                media_file.stored = None;
            }

            if local_files
                .remove(&media_file_store.file(METADATA_FILE))
                .is_none()
                && !media_file.needs_metadata
            {
                warn!(
                    media_item = media_file.media_item,
                    media_file = media_file.id,
                    "Metadata file was lost."
                );

                media_file.needs_metadata = true;
                changed = true;
            }

            let mut is_complete = !media_file.needs_metadata && media_file.stored.is_some();

            let known_alternates =
                models::AlternateFile::list_for_media_file(&mut conn, &media_file_store.file)
                    .await?;

            let mut wanted_alternates = alternates_for_media_file(
                store.config(),
                &media_file,
                public_items.contains(&media_file.media_item),
            );

            for mut alternate in known_alternates {
                let is_wanted = {
                    let len = wanted_alternates.len();
                    wanted_alternates.retain(|alt| !alt.matches(&alternate));
                    wanted_alternates.len() < len
                };

                if !is_wanted {
                    alternates_to_delete.push(alternate.id.clone());
                    continue;
                }

                if alternate.stored.is_some() {
                    let store = if alternate.local {
                        &mut local_files
                    } else {
                        &mut remote_files
                    };

                    let resource = media_file_store.file(&alternate.file_name);
                    let is_stored = if let Some(size) = store.get(&resource) {
                        size == alternate.file_size as u64
                    } else {
                        false
                    };

                    if !is_stored {
                        warn!(
                            media_item = media_file.media_item,
                            media_file = media_file.id,
                            alternate = alternate.id,
                            "Alternate file was lost."
                        );

                        is_complete = false;
                        alternate.stored = None;
                        alternates_to_update.push(alternate);
                    } else {
                        store.remove(&resource);
                    }
                } else {
                    is_complete = false;
                }
            }

            if !wanted_alternates.is_empty() {
                is_complete = false;
            }

            for alternate in wanted_alternates {
                let new_alternate = models::AlternateFile::new(&media_file.id, alternate);

                warn!(
                    media_item = media_file.media_item,
                    media_file = media_file.id,
                    alternate = new_alternate.id,
                    "Missing alternate added."
                );

                alternates_to_update.push(new_alternate);
            }

            if is_complete {
                valid_media_file = Some(media_file.clone());
            } else {
                // The temp file is still needed.
                temp_files.remove(&media_file_path);
            }

            if changed {
                media_files_to_update.push(media_file);
            }

            break;
        }

        while let Some((media_file, media_file_store)) = media_files.pop_front() {
            // If we don't yet have a valid media file then we want to keep potential alternatives.
            if valid_media_file.is_none() {
                let media_file_path = media_file_store.file(&media_file.file_name);

                let has_remote = media_file.stored.is_some()
                    && remote_files.get(&media_file_path) == Some(media_file.file_size as u64);
                let has_local =
                    temp_files.get(&media_file_path) == Some(media_file.file_size as u64);

                if !has_remote && !has_local {
                    // This media file is bad and needs to be deleted.
                    media_files_to_delete.push(media_file.id.clone());
                    continue;
                }

                // Otherwise just flag all its files as ignored.
                remote_files.remove(&media_file_path);
                temp_files.remove(&media_file_path);
                local_files.remove(&media_file_store.file(METADATA_FILE));

                let known_alternates =
                    models::AlternateFile::list_for_media_file(&mut conn, &media_file_store.file)
                        .await?;

                for alternate in known_alternates {
                    let resource = media_file_store.file(&alternate.file_name);
                    if alternate.local {
                        local_files.remove(&resource);
                    } else {
                        remote_files.remove(&resource);
                    }
                }
            } else {
                warn!(
                    media_item = media_file.media_item,
                    media_file = media_file.id,
                    "Deleting old media file."
                );

                media_files_to_delete.push(media_file.id.clone());
            }
        }

        let mut conn = store.connect().await?;
        let mut media_item = models::MediaItem::get(&mut conn, &media_item_store.item).await?;
        media_item.sync_with_file(valid_media_file.as_ref());
        models::MediaItem::upsert(&mut conn, &[media_item]).await?;

        models::MediaFile::upsert(&mut conn, &media_files_to_update).await?;
        models::MediaFile::delete(&mut conn, &media_files_to_delete).await?;
        models::AlternateFile::upsert(&mut conn, &alternates_to_update).await?;
        models::AlternateFile::delete(&mut conn, &alternates_to_delete).await?;
    }

    if delete_files {
        let catalog = CatalogStore {
            catalog: catalog.to_owned(),
        }
        .into();

        prune_storage(&local_store, &catalog, local_files).await?;
        prune_storage(&temp_store, &catalog, temp_files).await?;
        prune_storage(&remote_store, &catalog, remote_files).await?;
    } else {
        debug!(
            remote_files = remote_files.len(),
            local_files = local_files.len(),
            temp_store = temp_files.len(),
            "Skipping deletion"
        );
    }

    Ok(())
}

pub(super) async fn prune_media_files(store: Store, catalog: &str) -> Result {
    let mut conn = store.isolated(Isolation::Committed).await?;

    let storage = models::Storage::get_for_catalog(&mut conn, catalog).await?;
    let remote_store = storage.file_store(conn.config()).await?;
    let local_store = DiskStore::local_store(conn.config());
    let temp_store = DiskStore::temp_store(conn.config());

    models::MediaItem::update_media_files(&mut conn, catalog).await?;
    let prunable = models::MediaFile::list_prunable(&mut conn, catalog).await?;

    let ids: Vec<String> = prunable.iter().map(|(mf, _)| mf.id.clone()).collect();
    models::MediaFile::delete(&mut conn, &ids).await?;

    for (_, media_file_store) in prunable {
        remote_store.delete(&media_file_store).await.warn();
        local_store.delete(&media_file_store).await.warn();
        temp_store.delete(&media_file_store).await.warn();
    }

    conn.commit().await
}

pub(super) async fn prune_media_items(store: Store, catalog: &str) -> Result {
    let mut conn = store.isolated(Isolation::Committed).await?;

    let storage = models::Storage::get_for_catalog(&mut conn, catalog).await?;
    let remote_store = storage.file_store(conn.config()).await?;
    let local_store = DiskStore::local_store(conn.config());
    let temp_store = DiskStore::temp_store(conn.config());

    let prunable = models::MediaItem::list_prunable(&mut conn, catalog).await?;

    let ids: Vec<String> = prunable.iter().map(|(mi, _)| mi.id.clone()).collect();
    models::MediaItem::delete(&mut conn, &ids).await?;

    for (_, media_item_path) in prunable {
        remote_store.delete(&media_item_path).await.warn();
        local_store.delete(&media_item_path).await.warn();
        temp_store.delete(&media_item_path).await.warn();
    }

    conn.commit().await
}

pub(super) async fn trigger_media_tasks(store: Store, catalog: &str) -> Result {
    let mut conn = store.connect().await?;
    for media_file in models::MediaFile::list_needs_processing(&mut conn, catalog).await? {
        store
            .queue_task(Task::ProcessMediaFile { media_file })
            .await;
    }

    Ok(())
}

#[derive(Deserialize, Debug)]
struct SearchSubscription {
    email: String,
    last_update: DateTime<Utc>,
}

pub(super) async fn process_subscriptions(store: Store, catalog: &str) -> Result {
    let mut conn = store.connect().await?;

    let list = sqlx::query!(
        r#"
        SELECT "saved_search".*, MIN("last_update") AS "oldest_update!", jsonb_agg("subscription") AS "subscription!"
        FROM "saved_search"
            JOIN (
                SELECT "search", "last_update", jsonb_build_object('email', "email", 'last_update', "last_update") AS "subscription"
                FROM "subscription"
                ORDER BY "subscription"."last_update" ASC
            ) AS "s" ON "s"."search"="saved_search"."id"
        WHERE "saved_search"."catalog"=$1
        GROUP BY "saved_search"."id"
        "#,
        catalog
    )
    .try_map(|row| Ok((from_row!(SavedSearch(row)), row.oldest_update, Vec::<SearchSubscription>::decode(row.subscription)?)))
    .fetch_all(&mut conn)
    .await?;

    Ok(())
}
