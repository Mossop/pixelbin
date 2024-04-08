use tracing::instrument;

use crate::{task_queue::DbConnection, Result};

async fn download_media_file() -> Result {
    // Lock storage
    todo!();
}

async fn check_media_file() -> Result {
    todo!();

    // If complete?

    // Delete local file if present

    // Maybe update MediaItem

    // Maybe update searches
}

#[instrument(skip(conn), err)]
pub(super) async fn extract_metadata(conn: &mut DbConnection<'_>, media_file: &str) -> Result {
    download_media_file().await?;

    // Call exiftool/ffprobe

    // Update MediaFile

    check_media_file().await
}

#[instrument(skip(conn), err)]
pub(super) async fn upload_media_file(conn: &mut DbConnection<'_>, media_file: &str) -> Result {
    // Lock storage

    // Upload file

    // Update MediaFile

    check_media_file().await
}

#[instrument(skip(conn), err)]
pub(super) async fn build_alternate(conn: &mut DbConnection<'_>, alternate: &str) -> Result {
    download_media_file().await?;

    // Generate alternate file

    // Lock storage

    // Upload file

    // Update AlternateFile

    check_media_file().await
}

#[instrument(skip(conn), err)]
pub(super) async fn delete_media_file(conn: &mut DbConnection<'_>, media_file: &str) -> Result {
    todo!();

    // Lock storage

    // Delete MediaFile

    // Delete remote files

    // Delete local files
}
