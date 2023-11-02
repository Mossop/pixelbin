#![deny(unreachable_pub)]
//! Maintenance tasks for the Pixelbin server.

use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

use scoped_futures::ScopedFutureExt;

use pixelbin_shared::Result;
use pixelbin_store::{
    models::{MediaFile, MediaItem},
    DbQueries, RemotePath, Store,
};
use serde_json::from_str;
use tokio::fs::read_to_string;

use metadata::{Metadata, METADATA_FILE};
use tracing::error;

use crate::metadata::PROCESS_VERSION;

mod metadata;

pub async fn prune(_store: Store, _dry_run: bool) -> Result {
    Ok(())
}

async fn reprocess_media(
    media_item: &MediaItem,
    media_file: &MediaFile,
    file_path: &Path,
) -> Result<MediaFile> {
    let metadata_file = file_path.join(METADATA_FILE);
    let metadata = from_str::<Metadata>(&read_to_string(metadata_file).await?)?;

    Ok(metadata.media_file(&media_item.id, &media_file.id))
}

pub async fn reprocess_all_media(store: Store) -> Result {
    tracing::debug!("Reprocessing media metadata");

    store
        .in_transaction(|mut tx| {
            async move {
                let stores = tx.list_storage().await?;
                let mut media_files = Vec::new();

                for storage in stores {
                    let all_media = tx.list_all_media(&storage).await?;
                    for (media_item, media_file, file_path, _) in all_media {
                        if media_file.process_version != PROCESS_VERSION {
                            match reprocess_media(&media_item, &media_file, &file_path).await {
                                Ok(media_file) => media_files.push(media_file),
                                Err(e) => {
                                    error!(media = media_item.id, error = ?e, "Failed to process media metadata")
                                }
                            }
                        }
                    }
                }

                tx.upsert_media_files(&media_files).await?;

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
        .in_transaction(|mut tx| {
            async move {
                let catalogs = tx.list_catalogs().await?;

                for catalog in catalogs {
                    tx.update_searches(&catalog.id).await?;
                }
                Ok(())
            }
            .scope_boxed()
        })
        .await?;

    Ok(())
}

pub async fn verify_local_storage(store: Store) -> Result {
    tracing::debug!("Verifying local files");

    let mut local_files: HashMap<PathBuf, u64> =
        store.list_local_files().await?.into_iter().collect();
    let alternates = store.list_local_alternate_files().await?;
    let files = alternates.len();
    let mut errors = 0;

    for (alternate, _file_path, local_path) in alternates {
        match local_files.remove(&local_path) {
            Some(local_size) => {
                if local_size != (alternate.file_size as u64) {
                    tracing::error!("Local file {} was expected to be {} bytes but is actually {local_size} bytes", local_path.display(), alternate.file_size);
                    errors += 1;
                }
            }
            None => {
                tracing::error!("Local file {} was not found", local_path.display());
                errors += 1;
            }
        }
    }

    tracing::info!(
        "Verified {} local files. {} errors.",
        files - errors,
        errors
    );
    if !local_files.is_empty() {
        tracing::warn!("Saw {} local files that need pruning.", local_files.len());
    }

    Ok(())
}

pub async fn verify_online_storage(mut store: Store) -> Result {
    tracing::debug!("Verifying online files");

    let stores = store.list_storage().await?;
    let mut errors = 0;
    let mut files = 0;
    let mut prunable = 0;

    for storage in stores {
        let mut remote_files: HashMap<RemotePath, u64> =
            storage.list_remote_files(None).await?.into_iter().collect();

        let media_files = store.list_online_media_files(&storage).await?;
        files += media_files.len();
        for (media_file, _file_path, remote_path) in media_files {
            match remote_files.remove(&remote_path) {
                Some(remote_size) => {
                    if remote_size != (media_file.file_size as u64) {
                        tracing::error!("Stored file {remote_path} was expected to be {} bytes but is actually {remote_size} bytes", media_file.file_size);
                        errors += 1;
                    }
                }
                None => {
                    tracing::error!("Stored file {remote_path} was not found");
                    errors += 1;
                }
            }
        }

        let alternates = store.list_online_alternate_files(&storage).await?;
        files += alternates.len();
        for (alternate, _file_path, remote_path) in alternates {
            match remote_files.remove(&remote_path) {
                Some(remote_size) => {
                    if remote_size != (alternate.file_size as u64) {
                        tracing::error!("Stored file {remote_path} was expected to be {} bytes but is actually {remote_size} bytes", alternate.file_size);
                        errors += 1;
                    }
                }
                None => {
                    tracing::error!("Stored file {remote_path} was not found");
                    errors += 1;
                }
            }
        }

        prunable += remote_files.len();
    }

    tracing::info!(
        "Verified {} online files. {} errors.",
        files - errors,
        errors
    );
    if prunable > 0 {
        tracing::warn!("Saw {prunable} online files that need pruning.");
    }

    Ok(())
}
