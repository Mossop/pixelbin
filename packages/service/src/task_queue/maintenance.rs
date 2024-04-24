use std::collections::{HashMap, HashSet};

use futures::join;
use scoped_futures::ScopedFutureExt;
use tracing::{error, info};

use crate::{
    metadata::{alternates_for_media_file, Alternate, METADATA_FILE},
    store::{
        db::DbConnection,
        models,
        path::{CatalogPath, ResourcePath},
        FileStore, Isolation,
    },
    Ignorable, Result, Task,
};

pub(super) async fn server_startup(conn: &mut DbConnection<'_>) -> Result {
    let media = models::MediaItem::list_deleted(conn).await?;
    let media_ids = media.into_iter().map(|m| m.id).collect();
    conn.queue_task(Task::DeleteMedia { media: media_ids })
        .await;

    let catalogs = conn.list_catalogs().await?;

    for catalog in catalogs {
        models::MediaItem::update_media_files(conn, &catalog).await?;

        conn.queue_task(Task::UpdateSearches {
            catalog: catalog.clone(),
        })
        .await;

        conn.queue_task(Task::ProcessMedia {
            catalog: catalog.clone(),
        })
        .await;

        conn.queue_task(Task::PruneMediaFiles { catalog }).await;
    }

    Ok(())
}

pub(super) async fn update_searches(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
    models::SavedSearch::update_for_catalog(conn, catalog).await
}

pub(super) async fn verify_storage(
    conn: &mut DbConnection<'_>,
    catalog: &str,
    delete_files: bool,
) -> Result {
    let mut requires_metadata: u32 = 0;
    let mut requires_upload: u32 = 0;
    let mut unexpected_local: u32 = 0;
    let mut local_size: u64 = 0;
    let mut unexpected_remote: u32 = 0;
    let mut remote_size: u64 = 0;
    let mut missing_alternates: u32 = 0;

    conn.isolated(Isolation::Committed, |conn| {
        async move {
            let storage = models::Storage::lock_for_catalog(conn, catalog).await?;

            let remote_store = storage.file_store(conn.config()).await?;
            let local_store = conn.config().local_store();
            let temp_store = conn.config().temp_store();

            let resource = CatalogPath {
                catalog: catalog.to_owned(),
            };
            let (remote_files, local_files) = join!(
                remote_store.list_files(Some(&resource)),
                local_store.list_files(Some(&resource))
            );
            let mut remote_files = remote_files?;
            let mut local_files = local_files?;

            let media_files = models::MediaFile::list_for_catalog(conn, catalog).await?;
            let mut modified_media_files = Vec::new();
            let mut bad_media_files = Vec::new();

            let mut required_alternates: HashMap<String, Vec<Alternate>> = HashMap::new();

            for (mut media_file, media_file_path) in media_files {
                let metadata_file: ResourcePath = media_file_path.file(METADATA_FILE).into();
                let metadata_exists = local_files.contains_key(&metadata_file);

                let file_path = media_file_path.file(&media_file.file_name);

                let temp_exists = temp_store.exists(&file_path).await?;

                let expected_resource: ResourcePath = file_path.into();

                let needs_change = if media_file.stored.is_some()
                    && remote_files.get(&expected_resource) == Some(&(media_file.file_size as u64))
                {
                    // Media file is correctly uploaded.
                    if !metadata_exists && !media_file.needs_metadata {
                        media_file.needs_metadata = true;
                        true
                    } else {
                        false
                    }
                } else if temp_exists {
                    // We can re-upload this.
                    let needs_change = media_file.stored.is_some();
                    media_file.stored = None;
                    requires_upload += 1;

                    if !metadata_exists && !media_file.needs_metadata {
                        media_file.needs_metadata = true;
                        true
                    } else {
                        needs_change
                    }
                } else {
                    // This media file is bad
                    error!(file=%expected_resource, "Missing temp media file");
                    bad_media_files.push(media_file.id.clone());

                    continue;
                };

                remote_files.remove(&expected_resource);
                local_files.remove(&metadata_file);

                if media_file.needs_metadata {
                    requires_metadata += 1;
                }

                required_alternates.insert(
                    media_file.id.clone(),
                    alternates_for_media_file(conn.config(), &media_file),
                );

                if needs_change {
                    modified_media_files.push(media_file);
                }
            }

            models::MediaFile::upsert(conn, modified_media_files).await?;
            models::MediaFile::delete(conn, &bad_media_files).await?;

            let alternate_files = models::AlternateFile::list_for_catalog(conn, catalog).await?;
            let mut modified_alternate_files = Vec::new();

            for (mut alternate_file, media_file_path) in alternate_files {
                let expected_resource: ResourcePath = media_file_path.into();

                if let Some(required_alternates) =
                    required_alternates.get_mut(&alternate_file.media_file)
                {
                    required_alternates.retain(|alt| !alt.matches(&alternate_file));
                }

                // Waiting to be uploaded.
                if alternate_file.stored.is_none() {
                    missing_alternates += 1;
                    continue;
                }

                let stored_files = if alternate_file.local {
                    &mut local_files
                } else {
                    &mut remote_files
                };

                if alternate_file.stored.is_some()
                    && stored_files.get(&expected_resource)
                        == Some(&(alternate_file.file_size as u64))
                {
                    // All good!
                    stored_files.remove(&expected_resource);
                } else {
                    // We can re-upload this.
                    alternate_file.stored = None;
                    modified_alternate_files.push(alternate_file);
                    missing_alternates += 1;
                }
            }

            for (media_file, alternates) in required_alternates.into_iter() {
                for alternate in alternates {
                    missing_alternates += 1;
                    modified_alternate_files
                        .push(models::AlternateFile::new(&media_file, alternate));
                }
            }

            models::AlternateFile::upsert(conn, modified_alternate_files).await?;

            models::MediaItem::update_media_files(conn, catalog).await?;

            // TODO check unused metadata.json for MediaFiles to recover?

            for (path, size) in remote_files {
                unexpected_remote += 1;
                remote_size += size;
                if delete_files {
                    remote_store.delete(&path).await.warn();
                }
            }

            for (path, size) in local_files {
                unexpected_local += 1;
                local_size += size;
                if delete_files {
                    local_store.delete(&path).await.warn();
                }
            }

            let catalog_resource = CatalogPath {
                catalog: catalog.to_owned(),
            };

            if delete_files {
                remote_store.prune(&catalog_resource).await?;
                local_store.prune(&catalog_resource).await?;
                temp_store.prune(&catalog_resource).await?;
            }

            info!(
                catalog = catalog,
                bad_media = bad_media_files.len(),
                requires_metadata,
                requires_upload,
                missing_alternates,
                unexpected_local,
                local_size,
                unexpected_remote,
                remote_size,
                "Verify complete"
            );

            Ok(())
        }
        .scope_boxed()
    })
    .await
}

pub(super) async fn prune_media_files(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
    conn.isolated(Isolation::Committed, |conn| {
        async move {
            let storage = models::Storage::lock_for_catalog(conn, catalog).await?;
            let remote_store = storage.file_store(conn.config()).await?;
            let local_store = conn.config().local_store();
            let temp_store = conn.config().temp_store();

            models::MediaItem::update_media_files(conn, catalog).await?;
            let prunable = models::MediaFile::list_prunable(conn, catalog).await?;

            let ids: Vec<String> = prunable.iter().map(|(mf, _)| mf.id.clone()).collect();
            models::MediaFile::delete(conn, &ids).await?;

            for (_, media_file_path) in prunable {
                remote_store.delete(&media_file_path).await.warn();
                local_store.delete(&media_file_path).await.warn();
                temp_store.delete(&media_file_path).await.warn();
            }

            Ok(())
        }
        .scope_boxed()
    })
    .await
}

pub(super) async fn trigger_media_tasks(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
    for (media_file, _) in models::MediaFile::list_newest(conn, catalog).await? {
        if media_file.stored.is_none() {
            conn.queue_task(Task::UploadMediaFile {
                media_file: media_file.id.clone(),
            })
            .await;
        }

        if media_file.needs_metadata {
            conn.queue_task(Task::ExtractMetadata {
                media_file: media_file.id.clone(),
            })
            .await;
        }

        let mut alternate_types = HashSet::new();
        for alternate_file in
            models::AlternateFile::list_for_media_file(conn, &media_file.id).await?
        {
            if alternate_file.stored.is_none() {
                alternate_types.insert(alternate_file.mimetype.type_().to_string());
            }
        }

        for typ in alternate_types {
            conn.queue_task(Task::BuildAlternates {
                media_file: media_file.id.clone(),
                typ,
            })
            .await;
        }
    }

    Ok(())
}
