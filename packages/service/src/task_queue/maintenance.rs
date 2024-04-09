use futures::join;
use scoped_futures::ScopedFutureExt;
use tracing::{debug, error, instrument};

use crate::{
    metadata::METADATA_FILE,
    store::{
        db::DbConnection,
        models,
        path::{CatalogPath, ResourcePath},
        FileStore, Isolation,
    },
    Result, Task,
};

#[instrument(skip(conn), err)]
pub(super) async fn server_startup(conn: &mut DbConnection<'_>) -> Result {
    let catalogs = conn.list_catalogs().await?;

    for catalog in catalogs {
        conn.queue_task(Task::UpdateSearches {
            catalog: catalog.clone(),
        })
        .await;

        conn.queue_task(Task::ProcessMedia { catalog }).await;
    }

    Ok(())
}

#[instrument(skip(conn), err)]
pub(super) async fn update_searches(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
    models::SavedSearch::update_for_catalog(conn, catalog).await
}

#[instrument(skip(conn), err)]
pub(super) async fn verify_storage(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
    conn.isolated(Isolation::Committed, |conn| {
        async move {
            let storage = models::Storage::lock_for_catalog(conn, catalog).await?;

            let remote_store = storage.file_store().await?;
            let local_store = conn.config().local_store();
            let temp_store = conn.config().temp_store();

            let resource = CatalogPath {
                catalog: catalog.to_owned(),
            };
            let (remote_files, local_files) = join!(
                remote_store.list_file_sizes(Some(&resource)),
                local_store.list_file_sizes(Some(&resource))
            );
            let mut remote_files = remote_files?;
            let mut local_files = local_files?;

            let media_files = models::MediaFile::list_for_catalog(conn, catalog).await?;
            let mut modified_media_files = Vec::new();
            let mut bad_media_files = Vec::new();

            for (mut media_file, media_file_path) in media_files {
                let metadata_file: ResourcePath = media_file_path.file(METADATA_FILE).into();
                let metadata_exists = local_files.contains_key(&metadata_file);

                let file_path = media_file_path.file(&media_file.file_name);

                let temp_exists = temp_store.exists(&file_path).await?;

                let expected_resource: ResourcePath = file_path.into();

                if media_file.stored.is_some()
                    && remote_files.get(&expected_resource) == Some(&(media_file.file_size as u64))
                {
                    // Media file is correctly uploaded.
                    remote_files.remove(&expected_resource);
                    local_files.remove(&metadata_file);

                    if !metadata_exists && !media_file.needs_metadata {
                        media_file.needs_metadata = true;
                        modified_media_files.push(media_file);
                    }
                } else if temp_exists {
                    // We can re-upload this.
                    remote_files.remove(&expected_resource);
                    local_files.remove(&metadata_file);

                    let needs_change = media_file.stored.is_some()
                        || (!metadata_exists && !media_file.needs_metadata);
                    media_file.stored = None;
                    media_file.needs_metadata = !metadata_exists;

                    if needs_change {
                        modified_media_files.push(media_file);
                    }
                } else {
                    // This media file is bad
                    error!(file=%expected_resource, "Missing temp media file");
                    bad_media_files.push(media_file.id.clone());
                }
            }

            models::MediaFile::upsert(conn, modified_media_files).await?;
            models::MediaFile::delete(conn, &bad_media_files).await?;

            let alternate_files = models::AlternateFile::list_for_catalog(conn, catalog).await?;
            let mut modified_alternate_files = Vec::new();

            for (mut alternate_file, media_file_path) in alternate_files {
                let expected_resource: ResourcePath = media_file_path.into();

                // Waiting to be uploaded.
                if alternate_file.stored.is_none() {
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
                }
            }

            models::AlternateFile::upsert(conn, modified_alternate_files).await?;

            models::MediaItem::update_media_files(conn, catalog).await?;

            for path in remote_files.keys() {
                debug!(file=%path, "Unexpected remote file");
                // remote_store.delete(path).await?;
            }

            for path in local_files.keys() {
                debug!(file=%path, "Unexpected local file");
                local_store.delete(path).await?;
            }

            Ok(())
        }
        .scope_boxed()
    })
    .await

    // Lock storage

    // Get list of local files

    // Download list of remote files

    // Delete files that don't match MediaFiles or AlternateFiles

    // Clear stored for MediaFiles and AlternateFiles with no matching files.

    // Check MediaItems
}

#[instrument(skip(conn), err)]
pub(super) async fn prune_media_files(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
    todo!();
}

#[instrument(skip(conn), err)]
pub(super) async fn trigger_media_tasks(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
    todo!();

    // Find all the newest MediaFiles and their AlternateFiles
    // Trigger tasks as appropriate
}
