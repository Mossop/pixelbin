//! Maintenance tasks for the Pixelbin server.

use std::collections::{HashMap, HashSet};

use chrono::Timelike;
use scoped_futures::ScopedFutureExt;
use tracing::{debug, error, instrument, trace, warn};

use crate::{
    store::{
        metadata::{self, alternates_for_mimetype, Alternate, METADATA_FILE},
        models,
        path::MediaItemPath,
        DiskStore, Store,
    },
    FileStore,
};
use crate::{
    store::{
        metadata::{parse_metadata, Metadata},
        path::{CatalogPath, FilePath, MediaFilePath},
    },
    Result,
};

#[instrument(skip_all)]
pub async fn reprocess_all_media(store: Store) -> Result {
    tracing::debug!("Reprocessing media metadata");

    store
        .in_transaction(|conn| {
            async move {
                let catalogs = models::Catalog::list(conn).await?;

                for catalog in catalogs {
                    metadata::reprocess_catalog_media(conn, &catalog.id, true).await?
                }

                Ok(())
            }
            .scope_boxed()
        })
        .await?;

    Ok(())
}

pub async fn rebuild_searches(store: Store) -> Result {
    tracing::debug!("Rebuilding searches");

    store
        .in_transaction(|conn| {
            async move {
                let catalogs = models::Catalog::list(conn).await?;

                for catalog in catalogs {
                    models::SavedSearch::update_for_catalog(conn, &catalog.id).await?;
                }
                Ok(())
            }
            .scope_boxed()
        })
        .await?;

    Ok(())
}

fn check_alternate(
    alternates: &[(models::AlternateFile, FilePath)],
    expected_alternate: &Alternate,
) -> bool {
    alternates
        .iter()
        .any(|(alt, _)| expected_alternate.matches(alt))
}

type FileSets = (HashMap<String, u64>, HashMap<String, u64>);
pub async fn sanity_check_catalog(store: &Store, catalog: &str) -> Result {
    async fn append_files<F: FileStore>(
        file_store: &F,
        catalog: &str,
        is_local: bool,
        file_set: &mut HashMap<MediaFilePath, FileSets>,
    ) -> Result {
        for (path, size) in file_store
            .list_files(Some(
                &CatalogPath {
                    catalog: catalog.to_owned(),
                }
                .into(),
            ))
            .await?
        {
            if let Ok(file) = TryInto::<FilePath>::try_into(path) {
                let (ref mut local_files, ref mut remote_files) =
                    file_set.entry(file.media_file_path()).or_default();
                if is_local {
                    local_files.insert(file.file_name, size);
                } else {
                    remote_files.insert(file.file_name, size);
                }
            }
        }

        Ok(())
    }

    async fn delete_media_file<S: FileStore>(
        path: &MediaFilePath,
        local_store: &DiskStore,
        remote_store: &S,
    ) {
        if let Err(e) = local_store.delete(&path.clone().into()).await {
            warn!(error=?e, path=%path, "Failed to delete local media files");
        }

        if let Err(e) = remote_store.delete(&path.clone().into()).await {
            warn!(error=?e, path=%path, "Failed to delete remote media files");
        }
    }

    store
        .in_transaction(|conn| {
            async move {
                let storage = models::Storage::get_for_catalog(conn, catalog).await?;
                let remote_store = storage.file_store().await?;

                let mut file_set = HashMap::new();
                append_files(&remote_store, catalog, false, &mut file_set).await?;

                let local_store = conn.config().local_store();
                append_files(&local_store, catalog, true, &mut file_set).await?;

                let mut valid_media_files: Vec<MediaFilePath> = Vec::new();
                let mut media_files_to_reprocess: Vec<models::MediaFile> = Vec::new();
                let media_files = models::MediaFile::list_for_catalog(conn, catalog).await?;

                let mut alternate_files: HashMap<MediaFilePath, Vec<(models::AlternateFile, FilePath)>> = HashMap::new();

                models::AlternateFile::list_for_catalog(conn, catalog).await?.into_iter().for_each(|(alternate, path)| {
                    alternate_files.entry(path.media_file_path()).or_default().push((alternate, path));
                });

                for (mut media_file, media_file_path) in media_files {
                    if let Some((_, ref remote_files)) = file_set.get(&media_file_path) {
                        if let Some(size) = remote_files.get(&media_file.file_name) {
                            if size != &(media_file.file_size as u64) {
                                warn!(
                                    path=%media_file_path,
                                    database = media_file.file_size,
                                    actual = size,
                                    "Media file size mismatch"
                                );
                            }

                            if let Some(alternates) = alternate_files.get(&media_file_path) {
                                let expected = alternates_for_mimetype(conn.config(), &media_file.mimetype);

                                if !expected.iter().all(|expected| check_alternate(alternates, expected)) {
                                    debug!(path=%media_file_path, "Media file was missing some alternate files");
                                    media_file.process_version = 0;
                                    media_files_to_reprocess.push(media_file);
                                }
                            } else {
                                // All alternates are missing!
                                debug!(path=%media_file_path, "Media file was missing all alternate files");
                                media_file.process_version = 0;
                                media_files_to_reprocess.push(media_file);
                            }

                            valid_media_files.push(media_file_path);

                            continue;
                        }
                    }

                    // This media file is gone, delete it.
                    if let Err(e) = media_file.delete(conn, &storage, &media_file_path).await {
                        error!(error=?e, "Failed deleting media file");
                    }

                    file_set.remove(&media_file_path);
                }

                models::MediaFile::upsert(conn, &media_files_to_reprocess).await?;

                for (alternate, path) in alternate_files.into_values().flatten() {
                    if let Some((ref mut local_files, ref mut remote_files)) =
                        file_set.get_mut(&path.media_file_path())
                    {
                        let files = if alternate.local {
                            local_files
                        } else {
                            remote_files
                        };

                        if let Some(size) = files.get(&alternate.file_name) {
                            if size != &(alternate.file_size as u64) {
                                warn!(
                                    path=%path,
                                    database = alternate.file_size,
                                    actual = size,
                                    "Alternate file size mismatch"
                                );
                            }

                            continue;
                        }
                    }

                    // This alternate file is gone, delete it.
                    if let Err(e) = alternate.delete(conn, &storage, &path).await {
                        error!(error=?e, "Failed deleting alternate file");
                    }
                }

                for valid_media_file in valid_media_files {
                    file_set.remove(&valid_media_file);
                }

                models::MediaItem::update_media_files(conn, catalog).await?;

                // Everything left in fileset is not in the database. Find anything
                // that is recoverable
                let mut recoverable: HashMap<MediaItemPath, (MediaFilePath, Metadata)> = HashMap::new();

                let item_ids: Vec<&str> = file_set.keys().map(|media_file_path | media_file_path.item.as_str()).collect();
                let views: HashMap<String, models::MediaView> = models::MediaView::get(conn, &item_ids).await?.into_iter().map(|v| (v.id.clone(), v)).collect();

                let mut to_prune: HashSet<MediaFilePath> = HashSet::new();

                for (media_file_path, (local_files, remote_files)) in file_set.into_iter() {
                    to_prune.insert(media_file_path.clone());

                    if local_files.contains_key(METADATA_FILE) {
                        let metadata_file = local_store.local_path(&media_file_path.file(METADATA_FILE.to_owned()));
                        let metadata = match parse_metadata(&metadata_file).await {
                            Ok(m) => m,
                            Err(e) => {
                                warn!(path=%media_file_path, error=?e, "Failed to parse metadata file");
                                continue;
                            }
                        };

                        if let Some(view) = views.get(&media_file_path.item) {
                            if let Some(file) = &view.file {
                                // Skip files that are older than already known files
                                if file.uploaded.with_nanosecond(0) >= metadata.uploaded.with_nanosecond(0) {
                                    continue;
                                }
                            }
                        } else {
                            // Skip files that are for unknown items.
                            continue;
                        }

                        if let Some(size) = remote_files.get(&metadata.file_name) {
                            if size == &(metadata.file_size as u64) {
                                if let Some((existing_path, existing_metadata)) = recoverable.get_mut(&media_file_path.media_item()) {
                                    if existing_metadata.uploaded.with_nanosecond(0) < metadata.uploaded.with_nanosecond(0) {
                                        to_prune.insert(existing_path.clone());

                                        *existing_metadata = metadata;
                                        *existing_path = media_file_path;
                                    }
                                } else {
                                    to_prune.remove(&media_file_path);
                                    recoverable.insert(media_file_path.media_item(), (media_file_path, metadata));
                                }
                            } else {
                                // Size mismatch, prune???
                            }
                        }
                    }
                }

                for media_file_path in to_prune {
                    trace!(path=%media_file_path, "Deleting orphan media files");

                    delete_media_file(&media_file_path, &local_store, &remote_store).await;
                }

                let mut recovered_media_files = Vec::new();
                for (media_file_path, metadata) in recoverable.values() {
                    recovered_media_files.push(metadata.media_file(&media_file_path.item, &media_file_path.file));
                    debug!(path=%media_file_path, "Recovered media file");
                }

                if let Err(e) = models::MediaFile::upsert(conn, &recovered_media_files).await {
                    error!(error=?e, "Failed to recover media files");
                }

                Ok(())
            }
            .scope_boxed()
        })
        .await
}

pub async fn sanity_check_catalogs(store: Store) -> Result {
    let catalogs = store
        .with_connection(|conn| async move { models::Catalog::list(conn).await }.scope_boxed())
        .await?;

    for catalog in catalogs {
        if let Err(e) = sanity_check_catalog(&store, &catalog.id).await {
            error!(error=?e, catalog=catalog.id, "Failed checking catalog");
        }
    }

    Ok(())
}

pub async fn prune_catalog(store: &Store, catalog: &str) -> Result {
    store
        .in_transaction(|conn| {
            async move {
                models::MediaItem::update_media_files(conn, catalog).await?;

                let storage = models::Storage::get_for_catalog(conn, catalog).await?;

                let files = models::MediaFile::list_prunable(conn, catalog).await?;
                for (file, path) in files {
                    file.delete(conn, &storage, &path).await?;
                }

                Ok(())
            }
            .scope_boxed()
        })
        .await
}

pub async fn prune_catalogs(store: Store) -> Result {
    let catalogs = store
        .with_connection(|conn| async move { models::Catalog::list(conn).await }.scope_boxed())
        .await?;

    for catalog in catalogs {
        if let Err(e) = prune_catalog(&store, &catalog.id).await {
            error!(error=?e, catalog=catalog.id, "Failed pruning catalog");
        }
    }

    Ok(())
}
