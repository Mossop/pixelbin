use std::{cmp, collections::HashMap, path::PathBuf};

use scoped_futures::ScopedFutureExt;
use tokio::fs;
use tracing::instrument;

use crate::{
    metadata::{
        encode_alternate_image, encode_alternate_video, load_source_image, parse_media,
        parse_metadata, resize_image, FileMetadata, METADATA_FILE,
    },
    shared::{error::Ignorable, file_exists},
    store::{
        db::models,
        models::AlternateFileType,
        path::{FilePath, MediaFilePath},
        FileStore, Isolation,
    },
    task_queue::DbConnection,
    Error, Result,
};

#[instrument(skip(conn), err)]
async fn download_media_file(conn: &mut DbConnection<'_>, file_path: &FilePath) -> Result<PathBuf> {
    conn.isolated(Isolation::Committed, |conn| {
        async move {
            let temp_store = conn.config().temp_store();
            let temp_path = temp_store.local_path(file_path);

            if file_exists(&temp_path).await? {
                return Ok(temp_path);
            }

            let storage = models::Storage::lock_for_catalog(conn, &file_path.catalog).await?;

            // Check again after locking
            if file_exists(&temp_path).await? {
                return Ok(temp_path);
            }

            if let Some(parent) = temp_path.parent() {
                fs::create_dir_all(parent).await?;
            }

            let remote_store = storage.file_store(conn.config()).await?;

            remote_store.pull(file_path, &temp_path).await?;

            Ok(temp_path)
        }
        .scope_boxed()
    })
    .await
}

#[instrument(level = "trace", skip(conn), err)]
async fn check_media_file(conn: &mut DbConnection<'_>, media_file_path: &MediaFilePath) -> Result {
    let (media_file, _) = models::MediaFile::get(conn, &media_file_path.file).await?;

    if media_file.stored.is_none() || media_file.needs_metadata {
        return Ok(());
    }

    let alternates = models::AlternateFile::list_for_media_file(conn, &media_file.id).await?;
    if alternates.into_iter().any(|af| af.stored.is_none()) {
        // If there are any alternate files still to be generated then we should not remove the
        // temp file.
        return Ok(());
    }

    // Delete local file if present
    let temp_store = conn.config().temp_store();
    let temp_path = temp_store.local_path(&media_file_path.file(&media_file.file_name));

    fs::remove_file(&temp_path).await.ignore();

    Ok(())
}

pub(super) async fn extract_metadata(conn: &mut DbConnection<'_>, media_file: &str) -> Result {
    let (media_file, media_file_path) = models::MediaFile::get(conn, media_file).await?;
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

    conn.isolated(Isolation::Committed, |conn| {
        async move {
            let mut media_file = models::MediaFile::get_for_update(conn, &media_file.id).await?;
            metadata.apply_to_media_file(&mut media_file);
            models::MediaFile::upsert(conn, vec![media_file.clone()]).await
        }
        .scope_boxed()
    })
    .await?;

    models::MediaItem::update_media_files(conn, &media_file_path.catalog).await?;

    check_media_file(conn, &media_file_path).await
}

pub(super) async fn upload_media_file(conn: &mut DbConnection<'_>, media_file: &str) -> Result {
    let (mut media_file, media_file_path) = models::MediaFile::get(conn, media_file).await?;
    if media_file.stored.is_some() {
        models::MediaItem::update_media_files(conn, &media_file_path.catalog).await?;
        return check_media_file(conn, &media_file_path).await;
    }

    let temp_store = conn.config().temp_store();
    let file_path = media_file_path.file(&media_file.file_name);
    let temp_file = temp_store.local_path(&file_path);

    if !file_exists(&temp_file).await? {
        return Err(Error::UnexpectedPath {
            path: file_path.to_string(),
        });
    }

    let catalog = media_file_path.catalog.clone();
    conn.isolated(Isolation::Committed, |conn| {
        async move {
            let storage = models::Storage::lock_for_catalog(conn, &catalog).await?;
            let remote_store = storage.file_store(conn.config()).await?;

            remote_store
                .push(&temp_file, &file_path, &media_file.mimetype)
                .await?;

            media_file.mark_stored(conn).await
        }
        .scope_boxed()
    })
    .await?;

    models::MediaItem::update_media_files(conn, &media_file_path.catalog).await?;
    check_media_file(conn, &media_file_path).await
}

pub(super) async fn build_alternates(
    conn: &mut DbConnection<'_>,
    media_file: &str,
    typ: &str,
) -> Result {
    let (media_file, media_file_path) = models::MediaFile::get(conn, media_file).await?;
    let temp_file = download_media_file(conn, &media_file_path.file(&media_file.file_name)).await?;

    let mut images: HashMap<Option<i32>, Vec<models::AlternateFile>> = HashMap::new();
    let mut videos: Vec<models::AlternateFile> = Vec::new();

    for alternate_file in models::AlternateFile::list_for_media_file(conn, &media_file.id).await? {
        if alternate_file.mimetype.type_() != typ || alternate_file.stored.is_some() {
            continue;
        }

        if alternate_file.mimetype.type_() == mime::IMAGE {
            let size = if alternate_file.file_type == AlternateFileType::Thumbnail {
                Some(cmp::max(alternate_file.width, alternate_file.height))
            } else {
                None
            };

            images.entry(size).or_default().push(alternate_file);
        } else if alternate_file.mimetype.type_() == mime::VIDEO {
            videos.push(alternate_file);
        } else {
            panic!("Unexpected mimetype {}", alternate_file.mimetype);
        }
    }

    if !images.is_empty() {
        let source_image = load_source_image(&temp_file).await?;

        for (size, alternates) in images {
            let source_image = if let Some(size) = size {
                resize_image(source_image.clone(), size).await
            } else {
                source_image.clone()
            };

            for mut alternate_file in alternates {
                let file_path = media_file_path.file(&alternate_file.file_name);
                let built_file = encode_alternate_image(&mut alternate_file, &source_image).await?;

                conn.isolated(Isolation::Committed, |conn| {
                    async move {
                        let storage =
                            models::Storage::lock_for_catalog(conn, &file_path.catalog).await?;
                        if alternate_file.local {
                            let store = conn.config().local_store();
                            store
                                .push(&built_file, &file_path, &alternate_file.mimetype)
                                .await?;
                        } else {
                            let store = storage.file_store(conn.config()).await?;
                            store
                                .push(&built_file, &file_path, &alternate_file.mimetype)
                                .await?;
                        }

                        alternate_file.mark_stored(conn).await?;

                        Ok(())
                    }
                    .scope_boxed()
                })
                .await?;

                models::MediaItem::update_media_files(conn, &media_file_path.catalog).await?;
            }
        }
    }

    for mut alternate_file in videos {
        let file_path = media_file_path.file(&alternate_file.file_name);
        let built_file = encode_alternate_video(&temp_file, &mut alternate_file).await?;

        conn.isolated(Isolation::Committed, |conn| {
            async move {
                let storage = models::Storage::lock_for_catalog(conn, &file_path.catalog).await?;
                if alternate_file.local {
                    let store = conn.config().local_store();
                    store
                        .push(&built_file, &file_path, &alternate_file.mimetype)
                        .await?;
                } else {
                    let store = storage.file_store(conn.config()).await?;
                    store
                        .push(&built_file, &file_path, &alternate_file.mimetype)
                        .await?;
                }

                alternate_file.mark_stored(conn).await?;

                Ok(())
            }
            .scope_boxed()
        })
        .await?;

        models::MediaItem::update_media_files(conn, &media_file_path.catalog).await?;
    }

    check_media_file(conn, &media_file_path).await
}

pub(super) async fn prune_deleted_media(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
    let media = models::MediaItem::list_deleted(conn, catalog).await?;

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
        let remote_store = storage.file_store(conn.config()).await?;

        for media in media {
            let path = media.path();

            remote_store.delete(&path).await?;
            local_store.delete(&path).await?;
            temp_store.delete(&path).await?;
        }
    }

    for catalog in mapped.keys() {
        models::SavedSearch::update_for_catalog(conn, catalog).await?;
    }

    Ok(())
}
