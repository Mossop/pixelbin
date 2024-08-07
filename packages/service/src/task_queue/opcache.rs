use std::{
    collections::HashMap,
    future::Future,
    hash::Hash,
    path::PathBuf,
    sync::{Arc, LazyLock},
};

use async_once_cell::OnceCell;
use image::DynamicImage;
use tokio::{fs, sync::Mutex};

use crate::{
    metadata::{load_source_image, resize_image},
    shared::{error::Ignorable, file_exists},
    store::{db::DbConnection, models, path::MediaFilePath},
    FileStore, Result,
};

#[derive(Clone)]
struct Locker<R> {
    cell: Arc<OnceCell<R>>,
}

impl<R> Default for Locker<R> {
    fn default() -> Self {
        Self {
            cell: Default::default(),
        }
    }
}

impl<R> Locker<R>
where
    R: Clone,
{
    async fn perform<Fn, Fut>(&self, cb: Fn) -> Result<R>
    where
        Fut: Future<Output = Result<R>>,
        Fn: FnOnce() -> Fut,
    {
        self.cell
            .get_or_try_init(async { cb().await })
            .await
            .cloned()
    }
}

#[derive(Default, Clone)]
struct MultiLocker<P, R> {
    locks: Arc<Mutex<HashMap<P, Arc<OnceCell<R>>>>>,
}

impl<P, R> MultiLocker<P, R>
where
    P: Eq + Hash,
    R: Clone,
{
    async fn perform<Fn, Fut>(&self, params: P, cb: Fn) -> Result<R>
    where
        Fut: Future<Output = Result<R>>,
        Fn: FnOnce() -> Fut,
    {
        let cell = {
            let mut locks = self.locks.lock().await;
            locks.entry(params).or_default().clone()
        };
        cell.get_or_try_init(async { cb().await }).await.cloned()
    }
}

#[derive(Default)]
pub(super) struct OpCache {
    media_files: Arc<Mutex<HashMap<String, MediaFileOpCache>>>,
}

impl OpCache {
    pub(super) async fn for_media_file(
        &self,
        conn: &mut DbConnection<'_>,
        media_file_id: &str,
    ) -> Result<MediaFileOpCache> {
        let mut media_files = self.media_files.lock().await;
        let (media_file, media_file_path) = models::MediaFile::get(conn, media_file_id).await?;

        let mut cache = media_files
            .entry(media_file.id.clone())
            .or_insert_with(|| MediaFileOpCache::new(&media_file, &media_file_path))
            .clone();

        cache.media_file = media_file;
        Ok(cache)
    }
}

pub(super) static OP_CACHE: LazyLock<OpCache> = LazyLock::new(Default::default);

pub(super) struct MediaFileOpCache {
    pub(super) media_file: models::MediaFile,
    pub(super) media_file_path: MediaFilePath,

    storage_cell: OnceCell<models::Storage>,
    ensure_local_lock: Locker<PathBuf>,
    decode_lock: Locker<DynamicImage>,
    resize_locks: MultiLocker<i32, DynamicImage>,
}

impl Clone for MediaFileOpCache {
    fn clone(&self) -> Self {
        Self {
            media_file: self.media_file.clone(),
            media_file_path: self.media_file_path.clone(),

            storage_cell: Default::default(),
            ensure_local_lock: self.ensure_local_lock.clone(),
            decode_lock: self.decode_lock.clone(),
            resize_locks: self.resize_locks.clone(),
        }
    }
}

impl MediaFileOpCache {
    fn new(media_file: &models::MediaFile, media_file_path: &MediaFilePath) -> Self {
        Self {
            media_file: media_file.clone(),
            media_file_path: media_file_path.clone(),

            storage_cell: Default::default(),
            ensure_local_lock: Default::default(),
            decode_lock: Default::default(),
            resize_locks: Default::default(),
        }
    }

    pub(super) async fn release(&self, conn: &mut DbConnection<'_>) -> Result {
        let (media_file, _) = models::MediaFile::get(conn, &self.media_file_path.file).await?;

        if media_file.stored.is_none() || media_file.needs_metadata {
            return Ok(());
        }

        let alternates =
            models::AlternateFile::list_for_media_file(conn, &self.media_file.id).await?;
        if alternates.into_iter().any(|af| af.stored.is_none()) {
            // If there are any alternate files still to be generated then we should not remove the
            // temp file.
            return Ok(());
        }

        // Delete local file if present
        let temp_store = conn.config().temp_store();
        let temp_path = temp_store.local_path(&self.media_file_path.file(&media_file.file_name));

        fs::remove_file(&temp_path).await.ignore();

        let mut media_files = OP_CACHE.media_files.lock().await;
        media_files.remove(&self.media_file.id);

        Ok(())
    }

    pub(super) async fn lock_storage(
        &self,
        conn: &mut DbConnection<'_>,
    ) -> Result<models::Storage> {
        self.storage_cell
            .get_or_try_init(models::Storage::lock_for_catalog(
                conn,
                &self.media_file_path.catalog,
            ))
            .await
            .cloned()
    }

    pub(super) async fn ensure_local(&self, conn: &mut DbConnection<'_>) -> Result<PathBuf> {
        self.ensure_local_lock
            .perform(|| async {
                let file_path = self.media_file_path.file(&self.media_file.file_name);
                let temp_store = conn.config().temp_store();
                let temp_path = temp_store.local_path(&file_path);

                if file_exists(&temp_path).await? {
                    return Ok(temp_path);
                }

                if let Some(parent) = temp_path.parent() {
                    fs::create_dir_all(parent).await?;
                }

                let storage = self.lock_storage(conn).await?;

                // Check again after locking
                if file_exists(&temp_path).await? {
                    return Ok(temp_path);
                }

                let remote_store = storage.file_store(conn.config()).await?;

                remote_store.pull(&file_path, &temp_path).await?;

                Ok(temp_path)
            })
            .await
    }

    pub(super) async fn decode(&self, conn: &mut DbConnection<'_>) -> Result<DynamicImage> {
        self.decode_lock
            .perform(|| async {
                let path = self.ensure_local(conn).await?;
                load_source_image(&path).await
            })
            .await
    }

    pub(super) async fn resize(
        &self,
        conn: &mut DbConnection<'_>,
        size: i32,
    ) -> Result<DynamicImage> {
        self.resize_locks
            .perform(size, || async {
                let image = self.decode(conn).await?;
                Ok(resize_image(image, size).await)
            })
            .await
    }
}
