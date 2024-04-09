use std::{collections::HashMap, path::PathBuf};

use chrono::Utc;
use scoped_futures::ScopedFutureExt;
use tokio::fs;
use tracing::instrument;

use crate::{
    metadata::{encode_alternate, parse_media, parse_metadata, FileMetadata, METADATA_FILE},
    shared::{error::Ignorable, file_exists},
    store::{
        db::models,
        path::{FilePath, MediaFilePath, ResourcePath},
        FileStore, Isolation,
    },
    task_queue::DbConnection,
    Error, Result,
};

async fn download_media_file(conn: &mut DbConnection<'_>, file_path: &FilePath) -> Result<PathBuf> {
    conn.isolated(Isolation::Committed, |conn| {
        async move {
            let temp_store = conn.config().temp_store();
            let temp_path = temp_store.local_path(file_path);

            if file_exists(&temp_path).await? {
                return Ok(temp_path);
            }

            if let Some(parent) = temp_path.parent() {
                fs::create_dir_all(parent).await?;
            }

            let storage = models::Storage::lock_for_catalog(conn, &file_path.catalog).await?;
            let remote_store = storage.file_store().await?;

            remote_store.pull(file_path, &temp_path).await?;

            Ok(temp_path)
        }
        .scope_boxed()
    })
    .await
}

async fn check_media_file(
    conn: &mut DbConnection<'_>,
    media_file: models::MediaFile,
    media_file_path: MediaFilePath,
) -> Result {
    if media_file.stored.is_none() || media_file.needs_metadata {
        return Ok(());
    }

    let alternates = models::AlternateFile::list_for_media_file(conn, &media_file.id).await?;
    if alternates.into_iter().any(|af| af.stored.is_none()) {
        return Ok(());
    }

    // Delete local file if present
    let temp_store = conn.config().temp_store();
    let temp_path = temp_store.local_path(&media_file_path.file(&media_file.file_name));

    fs::remove_file(&temp_path).await.ignore();

    models::MediaItem::update_media_files(conn, &media_file_path.catalog).await?;

    Ok(())
}

#[instrument(skip(conn), err)]
pub(super) async fn extract_metadata(conn: &mut DbConnection<'_>, media_file: &str) -> Result {
    let (mut media_file, media_file_path) = models::MediaFile::get(conn, media_file).await?;
    let local_store = conn.config().local_store();

    let metadata_path = local_store.local_path(&media_file_path.file(METADATA_FILE));

    let metadata: FileMetadata = if file_exists(&metadata_path).await? {
        parse_metadata(&metadata_path).await?
    } else {
        let temp_file =
            download_media_file(conn, &media_file_path.file(&media_file.file_name)).await?;
        let mut metadata = parse_media(&temp_file).await?;
        metadata.file_name = media_file.file_name.clone();
        metadata.uploaded = media_file.uploaded;

        if let Some(parent) = metadata_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        fs::write(&metadata_path, serde_json::to_string_pretty(&metadata)?).await?;

        metadata
    };

    metadata.apply_to_media_file(&mut media_file);

    models::MediaFile::upsert(conn, vec![media_file.clone()]).await?;

    check_media_file(conn, media_file, media_file_path).await
}

#[instrument(skip(conn), err)]
pub(super) async fn upload_media_file(conn: &mut DbConnection<'_>, media_file: &str) -> Result {
    let (mut media_file, media_file_path) = models::MediaFile::get(conn, media_file).await?;
    let temp_store = conn.config().temp_store();
    let file_path = media_file_path.file(&media_file.file_name);
    let temp_file = temp_store.local_path(&file_path);

    if !file_exists(&temp_file).await? {
        return Err(Error::UnexpectedPath {
            path: file_path.to_string(),
        });
    }

    let catalog = media_file_path.catalog.clone();
    let media_file = conn
        .isolated(Isolation::Committed, |conn| {
            async move {
                let storage = models::Storage::lock_for_catalog(conn, &catalog).await?;
                let remote_store = storage.file_store().await?;

                // remote_store
                //     .push(&temp_file, &file_path, &media_file.mimetype)
                //     .await?;

                // media_file.stored = Some(Utc::now());

                models::MediaFile::upsert(conn, vec![media_file.clone()]).await?;

                Ok(media_file)
            }
            .scope_boxed()
        })
        .await?;

    check_media_file(conn, media_file, media_file_path).await
}

#[instrument(skip(conn), err)]
pub(super) async fn build_alternate(conn: &mut DbConnection<'_>, alternate: &str) -> Result {
    let (mut alternate_file, file_path) = models::AlternateFile::get(conn, alternate).await?;
    let (media_file, media_file_path) = models::MediaFile::get(conn, &file_path.file).await?;

    let temp_file = download_media_file(conn, &media_file_path.file(&media_file.file_name)).await?;
    let built_file = encode_alternate(&temp_file, &mut alternate_file).await?;

    conn.isolated(Isolation::Committed, |conn| {
        async move {
            let storage = models::Storage::lock_for_catalog(conn, &file_path.catalog).await?;
            let remote_store = storage.file_store().await?;

            // remote_store
            //     .push(&built_file, &file_path, &alternate_file.mimetype)
            //     .await?;

            // alternate_file.stored = Some(Utc::now());

            models::AlternateFile::upsert(conn, vec![alternate_file]).await?;

            Ok(())
        }
        .scope_boxed()
    })
    .await?;

    check_media_file(conn, media_file, media_file_path).await
}

#[instrument(skip_all, err)]
pub(super) async fn delete_media(conn: &mut DbConnection<'_>, ids: &[String]) -> Result {
    let media = models::MediaItem::get(conn, ids).await?;

    let media_ids = media.iter().map(|m| m.id.clone()).collect::<Vec<String>>();

    models::MediaItem::delete(conn, &media_ids).await?;

    let mut mapped: HashMap<String, Vec<models::MediaItem>> = HashMap::new();
    for m in media {
        mapped.entry(m.catalog.clone()).or_default().push(m);
    }

    let local_store = conn.config().local_store();
    let temp_store = conn.config().local_store();

    for (catalog, media) in mapped.iter() {
        let storage = models::Storage::get_for_catalog(conn, catalog).await?;
        let remote_store = storage.file_store().await?;

        for media in media {
            let path = ResourcePath::MediaItem(media.path());

            //remote_store.delete(&path).await?;
            local_store.delete(&path).await?;
            temp_store.delete(&path).await?;
        }
    }

    for catalog in mapped.keys() {
        models::SavedSearch::update_for_catalog(conn, catalog).await?;
    }

    Ok(())
}
