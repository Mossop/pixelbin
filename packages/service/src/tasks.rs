//! Maintenance tasks for the Pixelbin server.

use std::collections::HashMap;

use scoped_futures::ScopedFutureExt;
use tracing::{error, info, instrument, warn};

use crate::{
    store::path::{CatalogPath, FilePath},
    Result,
};
use crate::{
    store::{metadata, models, Store},
    FileStore,
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

pub async fn sanity_check_catalog(store: &Store, catalog: &str) -> Result {
    async fn list_files<F: FileStore>(
        file_store: &F,
        catalog: &str,
    ) -> Result<HashMap<FilePath, u64>> {
        Ok(file_store
            .list_files(Some(
                &CatalogPath {
                    catalog: catalog.to_owned(),
                }
                .into(),
            ))
            .await?
            .into_iter()
            .filter_map(|(p, s)| {
                if let Ok(file) = TryInto::<FilePath>::try_into(p) {
                    Some((file, s))
                } else {
                    None
                }
            })
            .collect())
    }

    store
        .in_transaction(|mut tx| {
            async move {
                let storage = models::Storage::get_for_catalog(&mut tx, catalog).await?;
                let remote_store = storage.file_store().await?;
                let mut remote_files = list_files(&remote_store, catalog).await?;

                let local_store = tx.config().local_store();
                let mut local_files: HashMap<FilePath, u64> =
                    list_files(&local_store, catalog).await?;

                let alternate_files =
                    models::AlternateFile::list_for_catalog(&mut tx, catalog).await?;

                for (alternate, path) in alternate_files {
                    let fileset = if alternate.local {
                        &mut local_files
                    } else {
                        &mut remote_files
                    };

                    if let Some(size) = fileset.remove(&path) {
                        if size != alternate.file_size as u64 {
                            warn!(
                                path=%path,
                                database = alternate.file_size,
                                actual = size,
                                "Alternate file size mismatch"
                            );
                        }
                    } else if let Err(e) = alternate.delete(&mut tx, &storage, &path).await {
                        error!(error=?e, "Failed deleting alternate file");
                    }
                }

                let media_files = models::MediaFile::list_for_catalog(&mut tx, catalog).await?;
                for (media_file, path) in media_files {
                    if let Some(size) = remote_files.remove(&path) {
                        if size != media_file.file_size as u64 {
                            warn!(
                                path=%path,
                                database = media_file.file_size,
                                actual = size,
                                "Media file size mismatch"
                            );
                        }
                    } else if let Err(e) = media_file.delete(&mut tx, &storage, &path).await {
                        error!(error=?e, "Failed deleting media file");
                    }
                }

                info!(count = remote_files.len(), "Remaining remote files");
                info!(count = local_files.len(), "Remaining local files");

                // 1. List all remote files
                // 2. List all alternate_file
                // 3. Delete any not present in storage from DB (we will rebuild later)
                // 4. List all media_file
                // 5. Delete any not present in storage from DB (no file means nothing we can do anyway)
                // 6. Look at any remote files not part of a known media_file, do any look like original media files?
                //   6.1. If so does the media_item exist and does it have no media_file?
                //   6.2. If so create a new media_file and reprocess it (using local metadata.json if it exists)
                // 7. Any other remote files can be deleted.
                // 8. Any other local files can be deleted.
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
