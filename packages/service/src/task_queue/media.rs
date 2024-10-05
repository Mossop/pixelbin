use std::{cmp, collections::HashMap};

use pixelbin_shared::IgnorableFuture;
use tokio::fs;
use tracing::{instrument, trace};

use crate::{
    metadata::{
        encode_alternate_image, encode_alternate_video, parse_media, parse_metadata, FileMetadata,
        METADATA_FILE,
    },
    shared::file_exists,
    store::{
        db::{models, Isolation},
        file::{DiskStore, FileStore},
        models::AlternateFileType,
        StoreType,
    },
    task_queue::opcache::MediaFileOpCache,
    worker::Command,
    Error, Result, Store, Task,
};

#[instrument(skip(store, op_cache), err)]
async fn extract_metadata(store: &Store, op_cache: MediaFileOpCache) -> Result {
    trace!("Extracting file metadata");

    let local_store = DiskStore::local_store(store.config());

    let metadata_path = local_store.local_path(&op_cache.media_file_store.file(METADATA_FILE));

    let metadata: FileMetadata = if file_exists(&metadata_path).await? {
        parse_metadata(&metadata_path).await?
    } else {
        let temp_file = op_cache.ensure_local().await?;
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

    let mut conn = store.isolated(Isolation::Committed).await?;
    let (mut media_file, _) = models::MediaFile::get(&mut conn, &op_cache.media_file.id).await?;
    metadata.apply_to_media_file(&mut media_file);
    models::MediaFile::upsert(&mut conn, &[media_file]).await?;
    conn.commit().await
}

#[instrument(skip(store), err)]
pub(super) async fn upload_media_file(mut store: Store, media_file_id: &str) -> Result {
    trace!("Uploading media file");

    let (media_file, media_file_store) = models::MediaFile::get(&mut store, media_file_id).await?;

    if media_file.stored.is_some() {
        return Ok(());
    }

    let guard = store
        .locks()
        .media_item(&store, &media_file_store.media_item_store())
        .for_update()
        .await;

    let mut op_cache = guard.file_ops(&media_file).await;

    let temp_store = DiskStore::temp_store(store.config());
    let file_path = op_cache
        .media_file_store
        .file(&op_cache.media_file.file_name);
    let temp_file = temp_store.local_path(&file_path);

    if !file_exists(&temp_file).await? {
        return Err(Error::UnexpectedPath {
            path: file_path.to_string(),
        });
    }

    let storage = op_cache.storage().await?;
    let remote_store = storage.file_store(store.config()).await?;

    remote_store
        .push(&temp_file, &file_path, &op_cache.media_file.mimetype)
        .await?;

    op_cache.media_file.mark_stored(&mut store).await
}

#[instrument(skip(store, op_cache), err)]
async fn build_alternate(
    store: &mut Store,
    op_cache: MediaFileOpCache,
    alternate_file: &mut models::AlternateFile,
) -> Result {
    if alternate_file.stored.is_some() {
        return Ok(());
    }

    let always_build = alternate_file.file_type == AlternateFileType::Social
        || (alternate_file.required && alternate_file.mimetype.type_() != mime::VIDEO);

    if !always_build && store.store_type() == StoreType::Server {
        return Ok(());
    }

    trace!(alternate_file=%alternate_file, "Building alternate file");

    let _guard = if alternate_file.mimetype.type_() == mime::VIDEO {
        Some(store.locks().enter_expensive_task().await)
    } else {
        None
    };

    let built_file = if alternate_file.mimetype.type_() == mime::IMAGE {
        let source_image = match alternate_file.file_type {
            AlternateFileType::Thumbnail => {
                op_cache
                    .resize(cmp::max(alternate_file.width, alternate_file.height))
                    .await?
            }
            AlternateFileType::Reencode => op_cache.decode().await?,
            AlternateFileType::Social => op_cache.resize_social().await?,
        };

        encode_alternate_image(alternate_file, &source_image).await?
    } else {
        let temp_file = op_cache.ensure_local().await?;
        encode_alternate_video(&temp_file, alternate_file).await?
    };

    let storage = op_cache.storage().await?;
    let file_path = op_cache.media_file_store.file(&alternate_file.file_name);
    if alternate_file.local {
        let store = DiskStore::local_store(store.config());
        store
            .push(&built_file, &file_path, &alternate_file.mimetype)
            .await?;
    } else {
        let store = storage.file_store(store.config()).await?;
        store
            .push(&built_file, &file_path, &alternate_file.mimetype)
            .await?;
    }

    alternate_file.mark_stored(store).await
}

#[instrument(skip(store), err)]
pub(super) async fn process_media_file(mut store: Store, media_file_id: &str) -> Result {
    trace!(media_file_id, "Processing media file");
    let (media_file, media_file_store) = models::MediaFile::get(&mut store, media_file_id).await?;

    let guard = store
        .locks()
        .media_item(&store, &media_file_store.media_item_store())
        .for_update()
        .await;

    let op_cache = guard.file_ops(&media_file).await;

    if media_file.stored.is_none() {
        store
            .queue_task(Task::UploadMediaFile {
                media_file: media_file_id.to_owned(),
            })
            .await;
    }

    if media_file.needs_metadata {
        extract_metadata(&store, op_cache.clone()).warn().await;
    }

    for mut alternate_file in
        models::AlternateFile::list_for_media_file(&mut store, &media_file_store.file).await?
    {
        build_alternate(&mut store, op_cache.clone(), &mut alternate_file)
            .warn()
            .await;
    }

    let mut conn = store.isolated(Isolation::Committed).await?;
    models::MediaItem::update_media_files(&mut conn, &op_cache.media_file_store.catalog).await?;
    conn.commit().await?;

    // Now see if there is social media required.
    let mut worker_needed = false;

    for mut alternate_file in
        models::AlternateFile::list_for_media_file(&mut store, &media_file_store.file).await?
    {
        build_alternate(&mut store, op_cache.clone(), &mut alternate_file)
            .warn()
            .await;

        if alternate_file.stored.is_none() {
            worker_needed = true;
        }
    }

    if worker_needed {
        store
            .send_worker_command(Command::ProcessMediaFile {
                media_file: media_file_id.to_owned(),
            })
            .await;
    } else {
        op_cache.release().warn().await;
    }

    trace!(media_file_id, "Processing complete");

    Ok(())
}

#[instrument(skip(store), err)]
pub(super) async fn prune_deleted_media(store: Store, catalog: &str) -> Result {
    let mut conn = store.pooled();
    let media = models::MediaItem::list_deleted(&mut conn, catalog).await?;

    let media_ids = media.iter().map(|m| m.id.clone()).collect::<Vec<String>>();

    models::MediaItem::delete(&mut conn, &media_ids).await?;

    let mut mapped: HashMap<String, Vec<models::MediaItem>> = HashMap::new();
    for m in media {
        mapped.entry(m.catalog.clone()).or_default().push(m);
    }

    let local_store = DiskStore::local_store(store.config());
    let temp_store = DiskStore::temp_store(store.config());

    for (catalog, media) in mapped.iter() {
        let storage = models::Storage::get_for_catalog(&mut conn, catalog).await?;
        let remote_store = storage.file_store(store.config()).await?;

        for media in media {
            let path = media.path();

            remote_store.delete(&path).await?;
            local_store.delete(&path).await?;
            temp_store.delete(&path).await?;
        }
    }

    for catalog in mapped.keys() {
        models::SavedSearch::update_for_catalog(&mut conn, catalog).await?;
    }

    Ok(())
}
