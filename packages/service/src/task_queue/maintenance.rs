use std::collections::{HashMap, HashSet};

use futures::join;
use pixelbin_shared::Ignorable;
use tracing::{error, info, Instrument};

use crate::{
    metadata::{alternates_for_media_file, Alternate, METADATA_FILE},
    store::{
        db::DbConnection,
        models,
        path::{CatalogStore, MediaFileStore, ResourcePath},
        DiskStore, FileStore, Isolation,
    },
    Result, Task,
};

pub(super) async fn server_startup(conn: &mut DbConnection<'_>) -> Result {
    let catalogs = conn.list_catalogs().await?;

    for catalog in catalogs {
        conn.queue_task(Task::DeleteMedia {
            catalog: catalog.clone(),
        })
        .await;

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

pub(super) async fn delete_alternate_files(
    conn: &mut DbConnection<'_>,
    alternate_files: &[String],
) -> Result {
    // TODO: Delete the files here.
    models::AlternateFile::delete(conn, alternate_files).await?;

    Ok(())
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
    let mut unexpected_temp: u32 = 0;
    let mut temp_size: u64 = 0;
    let mut unexpected_remote: u32 = 0;
    let mut remote_size: u64 = 0;
    let mut missing_alternates: u32 = 0;

    let mut conn = conn.isolated(Isolation::Committed).await?;

    let storage = models::Storage::lock_for_catalog(&mut conn, catalog).await?;

    let remote_store = storage.file_store(conn.config()).await?;
    let local_store = DiskStore::local_store(conn.config());
    let temp_store = DiskStore::temp_store(conn.config());

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

    let mut media_files: HashMap<String, (models::MediaFile, MediaFileStore)> =
        models::MediaFile::list_for_catalog(&mut conn, catalog)
            .await?
            .into_iter()
            .map(|(mf, mfs)| (mf.id.clone(), (mf, mfs)))
            .collect();
    let public_items = models::MediaItem::list_public(&mut conn, catalog).await?;
    let mut modified_media_files = Vec::new();
    let mut bad_media_files = Vec::new();

    let mut required_alternates: HashMap<String, Vec<Alternate>> = HashMap::new();
    let mut incomplete_media_files: HashSet<String> = HashSet::new();

    for (media_file, media_file_store) in media_files.values_mut() {
        let metadata_file: ResourcePath = media_file_store.file(METADATA_FILE).into();
        let metadata_exists = local_files.remove(&metadata_file).is_some();

        let file_path = media_file_store.file(&media_file.file_name);

        let temp_exists = temp_files.contains_key(&file_path.clone().into());

        let expected_resource: ResourcePath = file_path.into();

        let needs_change = if remote_files.remove(&expected_resource)
            == Some(media_file.file_size as u64)
            && media_file.stored.is_some()
        {
            // Media file is correctly uploaded.
            if !metadata_exists || media_file.needs_metadata {
                media_file.needs_metadata = !metadata_exists;
                true
            } else {
                false
            }
        } else if temp_exists {
            // We can re-upload this.
            let was_stored = media_file.stored.is_some();
            media_file.stored = None;
            requires_upload += 1;
            incomplete_media_files.insert(media_file.id.clone());

            if !metadata_exists || media_file.needs_metadata {
                media_file.needs_metadata = !metadata_exists;
                true
            } else {
                was_stored
            }
        } else {
            // This media file is bad
            error!(file=%expected_resource, "Missing temp media file");
            bad_media_files.push(media_file.id.clone());

            continue;
        };

        if media_file.needs_metadata {
            requires_metadata += 1;
            incomplete_media_files.insert(media_file.id.clone());
        }

        required_alternates.insert(
            media_file.id.clone(),
            alternates_for_media_file(
                conn.config(),
                media_file,
                public_items.contains(&media_file.media_item),
            ),
        );

        if needs_change {
            modified_media_files.push(media_file.clone());
        }
    }

    models::MediaFile::upsert(&mut conn, modified_media_files).await?;
    models::MediaFile::delete(&mut conn, &bad_media_files).await?;

    let alternate_files = models::AlternateFile::list_for_catalog(&mut conn, catalog).await?;
    let mut modified_alternate_files = Vec::new();
    let mut alternate_files_to_delete = Vec::new();

    for (mut alternate_file, media_file_path) in alternate_files {
        let expected_resource: ResourcePath = media_file_path.clone().into();

        let wanted = if let Some(required_alternates) =
            required_alternates.get_mut(&alternate_file.media_file)
        {
            let len = required_alternates.len();
            required_alternates.retain(|alt| !alt.matches(&alternate_file));
            len != required_alternates.len()
        } else {
            false
        };

        if !wanted {
            let path = media_file_path
                .media_file_store()
                .file(&alternate_file.file_name);
            if alternate_file.local {
                local_store.delete(&path).await?;
            } else {
                remote_store.delete(&path).await?;
            }
            alternate_files_to_delete.push(alternate_file.id.clone());
        } else {
            // Waiting to be uploaded.
            if alternate_file.stored.is_none() {
                missing_alternates += 1;
            } else {
                let stored_files = if alternate_file.local {
                    &mut local_files
                } else {
                    &mut remote_files
                };

                if stored_files.remove(&expected_resource) != Some(alternate_file.file_size as u64)
                {
                    // We can re-upload this.
                    alternate_file.stored = None;
                    modified_alternate_files.push(alternate_file);
                    missing_alternates += 1;

                    incomplete_media_files.insert(media_file_path.file.clone());
                }
            }
        }
    }

    for (media_file, alternates) in required_alternates.into_iter() {
        for alternate in alternates {
            missing_alternates += 1;
            modified_alternate_files.push(models::AlternateFile::new(&media_file, alternate));
            incomplete_media_files.insert(media_file.clone());
        }
    }

    models::AlternateFile::upsert(&mut conn, modified_alternate_files).await?;
    models::AlternateFile::delete(&mut conn, &alternate_files_to_delete).await?;

    models::MediaItem::update_media_files(&mut conn, catalog).await?;

    // TODO check unused metadata.json for MediaFiles to recover?

    for media_file in incomplete_media_files.into_iter() {
        if let Some((media_file, media_file_store)) = media_files.get(&media_file) {
            temp_files.remove(&media_file_store.file(&media_file.file_name).into());
        }
    }

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

    for (path, size) in temp_files {
        unexpected_temp += 1;
        temp_size += size;
        if delete_files {
            temp_store.delete(&path).await.warn();
        }
    }

    let catalog_resource = CatalogStore {
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
        unexpected_temp,
        temp_size,
        unexpected_remote,
        remote_size,
        "Verify complete"
    );

    conn.commit().await
}

pub(super) async fn prune_media_files(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
    let mut conn = conn.isolated(Isolation::Committed).await?;

    let storage = models::Storage::lock_for_catalog(&mut conn, catalog).await?;
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

pub(super) async fn prune_media_items(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
    let mut conn = conn.isolated(Isolation::Committed).await?;

    let storage = models::Storage::lock_for_catalog(&mut conn, catalog).await?;
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

pub(super) async fn trigger_media_tasks(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
    for media_file in models::MediaFile::list_needs_processing(conn, catalog).await? {
        conn.queue_task(Task::ProcessMediaFile { media_file }).await;
    }

    Ok(())
}
