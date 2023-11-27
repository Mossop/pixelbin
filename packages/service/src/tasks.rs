//! Maintenance tasks for the Pixelbin server.

use std::{cmp, collections::HashMap, str::FromStr};

use chrono::Timelike;
use mime::Mime;
use scoped_futures::ScopedFutureExt;
use tracing::{debug, error, instrument, trace, warn};

use crate::{
    store::{
        metadata::{self, alternates_for_mimetype, METADATA_FILE},
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
        .in_transaction(|mut tx| {
            async move { metadata::reprocess_all_media(&mut tx).await }.scope_boxed()
        })
        .await?;

    Ok(())
}

pub async fn rebuild_searches(store: Store) -> Result {
    tracing::debug!("Rebuilding searches");

    store
        .in_transaction(|mut tx| {
            async move {
                let catalogs = models::Catalog::list(&mut tx).await?;

                for catalog in catalogs {
                    models::SavedSearch::update_for_catalog(&mut tx, &catalog.id).await?;
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
    file_type: models::AlternateFileType,
    mime_type: &str,
    size: Option<i32>,
) -> bool {
    alternates.iter().any(|(alt, _)| {
        if alt.file_type != file_type {
            return false;
        }

        if let Some(size) = size {
            if cmp::max(alt.width, alt.height) != size {
                return false;
            }
        }

        if let Ok(mime) = Mime::from_str(&alt.mimetype) {
            mime.essence_str() == mime_type
        } else {
            false
        }
    })
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
        .in_transaction(|mut tx| {
            async move {
                let storage = models::Storage::get_for_catalog(&mut tx, catalog).await?;
                let remote_store = storage.file_store().await?;

                let mut file_set = HashMap::new();
                append_files(&remote_store, catalog, false, &mut file_set).await?;

                let local_store = tx.config().local_store();
                append_files(&local_store, catalog, true, &mut file_set).await?;

                let mut valid_media_files: Vec<MediaFilePath> = Vec::new();
                let mut media_files_to_reprocess: Vec<models::MediaFile> = Vec::new();
                let media_files = models::MediaFile::list_for_catalog(&mut tx, catalog).await?;

                let mut alternate_files: HashMap<MediaFilePath, Vec<(models::AlternateFile, FilePath)>> = HashMap::new();

                models::AlternateFile::list_for_catalog(&mut tx, catalog).await?.into_iter().for_each(|(alternate, path)| {
                    alternate_files.entry(path.media_file_path()).or_default().push((alternate, path));
                });

                for (mut media_file, path) in media_files {
                    let media_file_path = path.media_file_path();

                    if let Some((_, ref remote_files)) = file_set.get(&media_file_path) {
                        if let Some(size) = remote_files.get(&media_file.file_name) {
                            if size != &(media_file.file_size as u64) {
                                warn!(
                                    path=%path,
                                    database = media_file.file_size,
                                    actual = size,
                                    "Media file size mismatch"
                                );
                            }

                            if let Some(alternates) = alternate_files.get(&media_file_path) {
                                let expected = alternates_for_mimetype(tx.config(), &media_file.mimetype);

                                if !expected.iter().all(|(file_type, mime_type, size)| check_alternate(alternates, *file_type, mime_type, *size)) {
                                    debug!(path=%media_file_path, "Media file was missing some alternate files");
                                    media_file.process_version = 0;
                                    media_files_to_reprocess.push(media_file);
                                }
                            } else {
                                // All alternates are missing!
                                debug!(path=%media_file_path, "Media file was missing some alternate files");
                                media_file.process_version = 0;
                                media_files_to_reprocess.push(media_file);
                            }

                            valid_media_files.push(media_file_path);

                            continue;
                        }
                    }

                    // This media file is gone, delete it.
                    if let Err(e) = media_file.delete(&mut tx, &storage, &path).await {
                        error!(error=?e, "Failed deleting media file");
                    }

                    file_set.remove(&media_file_path);
                }

                models::MediaFile::upsert(&mut tx, &media_files_to_reprocess).await?;

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
                    if let Err(e) = alternate.delete(&mut tx, &storage, &path).await {
                        error!(error=?e, "Failed deleting alternate file");
                    }
                }

                for valid_media_file in valid_media_files {
                    file_set.remove(&valid_media_file);
                }

                models::MediaItem::update_media_files(&mut tx).await?;

                // Everything left in fileset is not in the database. Find anything
                // that is recoverable
                let mut recoverable: HashMap<MediaItemPath, (MediaFilePath, Metadata)> = HashMap::new();

                for (media_file_path, (local_files, remote_files)) in file_set.into_iter() {
                    if local_files.contains_key(METADATA_FILE) {
                        let metadata_file = local_store.local_path(&media_file_path.file(METADATA_FILE.to_owned()));
                        let metadata = match parse_metadata(&metadata_file).await {
                            Ok(m) => m,
                            Err(e) => {
                                warn!(path=%media_file_path, error=?e, "Failed to parse metadata file");
                                continue;
                            }
                        };

                        if let Some(size) = remote_files.get(&metadata.file_name) {
                            if size == &(metadata.file_size as u64) {
                                if let Some((existing_path, existing_metadata)) = recoverable.get_mut(&media_file_path.media_item()) {
                                    if existing_metadata.uploaded.with_nanosecond(0) < metadata.uploaded.with_nanosecond(0) {
                                        delete_media_file(existing_path, &local_store, &remote_store).await;

                                        *existing_metadata = metadata;
                                        *existing_path = media_file_path;
                                    }
                                } else {
                                    recoverable.insert(media_file_path.media_item(), (media_file_path, metadata));
                                }
                            }

                            continue;
                        }
                    }

                    trace!(path=%media_file_path, "Deleting orphan media files");

                    delete_media_file(&media_file_path, &local_store, &remote_store).await;
                }

                let items: Vec<String> = recoverable.keys().map(|p| p.item.clone()).collect();
                let ids: Vec<&str> = items.iter().map(String::as_ref).collect();

                let views: HashMap<String, models::MediaView> = models::MediaView::get(&mut tx, &ids).await?.into_iter().map(|v| (v.id.clone(), v)).collect();

                for (media_file_path, metadata) in recoverable.values() {
                    if let Some(view) = views.get(&media_file_path.item) {
                        if let Some(ref file) = view.file {
                            if file.uploaded.with_nanosecond(0).unwrap() >= metadata.uploaded.with_nanosecond(0).unwrap() {
                                // Already have a more recent media file present.
                                delete_media_file(media_file_path, &local_store, &remote_store).await;

                                continue;
                            }
                        }

                        let mut media_file = metadata.media_file(&media_file_path.item, &media_file_path.file);
                        // Explicitely flag this as needing re-processing.
                        media_file.process_version = 0;

                        if let Err(e) = models::MediaFile::upsert(&mut tx, &[media_file]).await {
                            error!(error=?e, "Failed to recover media file");
                        }
                    } else {
                        delete_media_file(media_file_path, &local_store, &remote_store).await;
                    }
                }

                Ok(())
            }
            .scope_boxed()
        })
        .await
}

pub async fn sanity_check_catalogs(store: Store) -> Result {
    let catalogs = store
        .with_connection(|mut conn| {
            async move { models::Catalog::list(&mut conn).await }.scope_boxed()
        })
        .await?;

    for catalog in catalogs {
        if let Err(e) = sanity_check_catalog(&store, &catalog.id).await {
            error!(error=?e, catalog=catalog.id, "Failed checking catalog");
        }
    }

    Ok(())
}
