use std::{cmp, collections::HashMap};

use futures::{stream::FuturesUnordered, FutureExt, StreamExt};
use scoped_futures::ScopedFutureExt;
use tokio::fs;
use tracing::{instrument, warn};

use crate::{
    metadata::{
        encode_alternate_image, encode_alternate_video, parse_media, parse_metadata, FileMetadata,
        METADATA_FILE,
    },
    shared::{error::Ignorable, file_exists},
    store::{db::models, models::AlternateFileType, FileStore, Isolation},
    task_queue::{
        opcache::{MediaFileOpCache, OP_CACHE},
        DbConnection,
    },
    Error, Result,
};

#[instrument(skip(conn, op_cache), err)]
async fn extract_metadata(conn: &mut DbConnection<'_>, op_cache: MediaFileOpCache) -> Result {
    conn.isolated(Isolation::Committed, |conn| {
        async move {
            let local_store = conn.config().local_store();

            let metadata_path =
                local_store.local_path(&op_cache.media_file_path.file(METADATA_FILE));

            let metadata: FileMetadata = if file_exists(&metadata_path).await? {
                parse_metadata(&metadata_path).await?
            } else {
                let temp_file = op_cache.ensure_local(conn).await?;
                let mut metadata = parse_media(&temp_file).await?;
                metadata
                    .file_name
                    .clone_from(&op_cache.media_file.file_name);
                metadata.uploaded = op_cache.media_file.uploaded;

                if let Some(parent) = metadata_path.parent() {
                    fs::create_dir_all(parent).await?;
                }
                fs::write(&metadata_path, serde_json::to_string_pretty(&metadata)?).await?;

                metadata
            };

            let mut media_file =
                models::MediaFile::get_for_update(conn, &op_cache.media_file.id).await?;
            metadata.apply_to_media_file(&mut media_file);
            models::MediaFile::upsert(conn, vec![media_file.clone()]).await?;

            models::MediaItem::update_media_files(conn, &op_cache.media_file_path.catalog).await
        }
        .scope_boxed()
    })
    .await
}

#[instrument(skip(conn, op_cache), err)]
async fn upload_media_file(conn: &mut DbConnection<'_>, mut op_cache: MediaFileOpCache) -> Result {
    conn.isolated(Isolation::Committed, |conn| {
        async move {
            if op_cache.media_file.stored.is_some() {
                models::MediaItem::update_media_files(conn, &op_cache.media_file_path.catalog)
                    .await?;
                return op_cache.release(conn).await;
            }

            let temp_store = conn.config().temp_store();
            let file_path = op_cache
                .media_file_path
                .file(&op_cache.media_file.file_name);
            let temp_file = temp_store.local_path(&file_path);

            if !file_exists(&temp_file).await? {
                return Err(Error::UnexpectedPath {
                    path: file_path.to_string(),
                });
            }

            let storage =
                models::Storage::lock_for_catalog(conn, &op_cache.media_file_path.catalog).await?;
            let remote_store = storage.file_store(conn.config()).await?;

            remote_store
                .push(&temp_file, &file_path, &op_cache.media_file.mimetype)
                .await?;

            op_cache.media_file.mark_stored(conn).await?;

            models::MediaItem::update_media_files(conn, &op_cache.media_file_path.catalog).await
        }
        .scope_boxed()
    })
    .await
}

#[instrument(skip(conn, op_cache), err)]
async fn build_alternate(
    conn: &mut DbConnection<'_>,
    op_cache: MediaFileOpCache,
    mut alternate_file: models::AlternateFile,
) -> Result {
    let _guard = if alternate_file.mimetype.type_() == mime::VIDEO {
        Some(conn.config().enter_expensive_task().await)
    } else {
        None
    };

    conn.isolated(Isolation::Committed, |conn| {
        async move {
            let built_file = if alternate_file.mimetype.type_() == mime::IMAGE {
                let source_image = if alternate_file.file_type == AlternateFileType::Thumbnail {
                    op_cache
                        .resize(conn, cmp::max(alternate_file.width, alternate_file.height))
                        .await?
                } else {
                    op_cache.decode(conn).await?
                };

                encode_alternate_image(&mut alternate_file, &source_image).await?
            } else {
                let temp_file = op_cache.ensure_local(conn).await?;
                encode_alternate_video(&temp_file, &mut alternate_file).await?
            };

            let storage = op_cache.lock_storage(conn).await?;
            let file_path = op_cache.media_file_path.file(&alternate_file.file_name);
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

            models::MediaItem::update_media_files(conn, &op_cache.media_file_path.catalog).await
        }
        .scope_boxed()
    })
    .await
}

#[instrument(skip(conn), err)]
pub(super) async fn process_media_file(conn: &mut DbConnection<'_>, media_file_id: &str) -> Result {
    let op_cache = OP_CACHE.for_media_file(conn, media_file_id).await?;

    let tasks = FuturesUnordered::new();

    if op_cache.media_file.stored.is_none() {
        let store = conn.store();
        let op_cache = op_cache.clone();

        tasks.push(
            async move {
                match store.connect().await {
                    Ok(mut conn) => upload_media_file(&mut conn, op_cache).await.warn(),
                    Err(e) => warn!(error=?e),
                }
            }
            .boxed(),
        );
    }

    if op_cache.media_file.needs_metadata {
        let store = conn.store();
        let op_cache = op_cache.clone();

        tasks.push(
            async move {
                match store.connect().await {
                    Ok(mut conn) => extract_metadata(&mut conn, op_cache).await.warn(),
                    Err(e) => warn!(error=?e),
                }
            }
            .boxed(),
        );
    }

    for alternate_file in models::AlternateFile::list_for_media_file(conn, media_file_id).await? {
        if alternate_file.stored.is_none() {
            let store = conn.store();
            let op_cache = op_cache.clone();

            tasks.push(
                async move {
                    match store.connect().await {
                        Ok(mut conn) => build_alternate(&mut conn, op_cache, alternate_file)
                            .await
                            .warn(),
                        Err(e) => warn!(error=?e),
                    }
                }
                .boxed(),
            );
        }
    }

    tasks.count().await;

    op_cache.release(conn).await
}

#[instrument(skip(conn), err)]
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
