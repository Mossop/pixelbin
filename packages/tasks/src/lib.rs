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

use crate::metadata::{lookup_timezone, PROCESS_VERSION};

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
                let mut media_items = Vec::new();
                let mut media_files = Vec::new();

                for storage in stores {
                    let all_media = tx.list_all_media(&storage).await?;
                    for (mut media_item, media_file, file_path, _) in all_media {
                        let media_file = if media_file.process_version != PROCESS_VERSION {
                            match reprocess_media(&media_item, &media_file, &file_path).await {
                                Ok(media_file) => {
                                    media_files.push(media_file.clone());
                                    media_file
                                },
                                Err(e) => {
                                    error!(media = media_item.id, error = ?e, "Failed to process media metadata");
                                    continue;
                                }
                            }
                        } else {
                            media_file
                        };

                        if media_item.filename == media_file.filename { media_item.filename = None }
                        if media_item.title == media_file.title { media_item.title = None }
                        if media_item.description == media_file.description { media_item.description = None }
                        if media_item.label == media_file.label { media_item.label = None }
                        if media_item.category == media_file.category { media_item.category = None }
                        if media_item.location == media_file.location { media_item.location = None }
                        if media_item.city == media_file.city { media_item.city = None }
                        if media_item.state == media_file.state { media_item.state = None }
                        if media_item.country == media_file.country { media_item.country = None }
                        if media_item.make == media_file.make { media_item.make = None }
                        if media_item.model == media_file.model { media_item.model = None }
                        if media_item.lens == media_file.lens { media_item.lens = None }
                        if media_item.photographer == media_file.photographer { media_item.photographer = None }
                        if media_item.shutter_speed == media_file.shutter_speed { media_item.shutter_speed = None }
                        if media_item.taken_zone == media_file.taken_zone { media_item.taken_zone = None }
                        if media_item.orientation == media_file.orientation { media_item.orientation = None }
                        if media_item.iso == media_file.iso { media_item.iso = None }
                        if media_item.rating == media_file.rating { media_item.rating = None }
                        if media_item.longitude == media_file.longitude { media_item.longitude = None }
                        if media_item.latitude == media_file.latitude { media_item.latitude = None }
                        if media_item.altitude == media_file.altitude { media_item.altitude = None }
                        if media_item.aperture == media_file.aperture { media_item.aperture = None }
                        if media_item.focal_length == media_file.focal_length { media_item.focal_length = None }

                        if let (Some(item_taken), Some(file_taken)) = (media_item.taken, media_file.taken) {
                            if item_taken.replace_millisecond(0) == file_taken.replace_millisecond(0) {
                                media_item.taken = None;
                            }
                        }

                        match (media_item.longitude, media_item.latitude) {
                            (Some(longitude), Some(latitude)) => {
                                media_item.taken_zone = lookup_timezone(longitude as f64, latitude as f64)
                            },
                            _ => media_item.taken_zone = None,
                        }

                        media_items.push(media_item);
                    }
                }

                tx.upsert_media_files(&media_files).await?;
                tx.upsert_media_items(&media_items).await?;

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
