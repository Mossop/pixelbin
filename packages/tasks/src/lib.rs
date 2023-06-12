#![deny(unreachable_pub)]
//! Maintenance tasks for the Pixelbin server.

use std::{collections::HashMap, path::PathBuf};

use pixelbin_shared::Result;
use pixelbin_store::{DbQueries, RemotePath, Store};

pub async fn prune(_store: Store, _dry_run: bool) -> Result {
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
