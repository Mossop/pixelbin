use std::{collections::HashMap, future::Future, hash::Hash, path::PathBuf, sync::Arc};

use image::DynamicImage;
use pixelbin_shared::Ignorable;
use tokio::{
    fs,
    sync::{Mutex, OnceCell},
};

use crate::{
    metadata::{crop_image, load_source_image, resize_image},
    shared::file_exists,
    store::{
        file::{DiskStore, FileStore},
        locks::MediaItemLock,
        models,
        path::MediaFileStore,
    },
    Result, Store,
};

const SOCIAL_WIDTH: u32 = 1200;
const SOCIAL_HEIGHT: u32 = 630;

#[derive(Clone)]
struct Task<R> {
    cell: Arc<OnceCell<R>>,
}

impl<R> Default for Task<R> {
    fn default() -> Self {
        Self {
            cell: Default::default(),
        }
    }
}

impl<R> Task<R>
where
    R: Clone,
{
    async fn perform<Fn, Fut>(&self, cb: Fn) -> Result<R>
    where
        Fut: Future<Output = Result<R>>,
        Fn: FnOnce() -> Fut,
    {
        let result = self.cell.get_or_try_init(cb).await;

        result.cloned()
    }
}

#[derive(Default, Clone)]
struct Tasks<P, R> {
    tasks: Arc<Mutex<HashMap<P, Task<R>>>>,
}

impl<P, R> Tasks<P, R>
where
    P: Eq + Hash,
    R: Clone,
{
    async fn perform<Fn, Fut>(&self, params: P, cb: Fn) -> Result<R>
    where
        Fut: Future<Output = Result<R>>,
        Fn: FnOnce() -> Fut,
    {
        let task = {
            let mut tasks = self.tasks.lock().await;
            tasks.entry(params).or_default().clone()
        };

        task.perform(cb).await
    }
}

#[derive(Clone)]
pub(crate) struct MediaFileOpCache {
    _guard: Arc<MediaItemLock>,
    store: Store,
    pub(super) media_file: models::MediaFile,
    pub(super) media_file_store: MediaFileStore,

    storage: Task<models::Storage>,
    ensure_local: Task<PathBuf>,
    decode: Task<DynamicImage>,
    social: Task<DynamicImage>,
    resize: Tasks<i32, DynamicImage>,
}

impl MediaFileOpCache {
    pub(crate) fn new(
        guard: Arc<MediaItemLock>,
        store: Store,
        media_file: &models::MediaFile,
        media_file_store: &MediaFileStore,
    ) -> Self {
        Self {
            _guard: guard,
            store,
            media_file: media_file.clone(),
            media_file_store: media_file_store.clone(),

            storage: Default::default(),
            ensure_local: Default::default(),
            decode: Default::default(),
            social: Default::default(),
            resize: Default::default(),
        }
    }

    pub(super) async fn release(&self) -> Result {
        let mut conn = self.store.connect().await?;
        let (media_file, _) =
            models::MediaFile::get(&mut conn, &self.media_file_store.file).await?;

        if media_file.stored.is_none() || media_file.needs_metadata {
            return Ok(());
        }

        let alternates =
            models::AlternateFile::list_for_media_file(&mut conn, &self.media_file.id).await?;
        if alternates.into_iter().any(|af| af.stored.is_none()) {
            // If there are any alternate files still to be generated then we should not remove the
            // temp file.
            return Ok(());
        }

        // Delete local file if present
        let temp_store = DiskStore::temp_store(conn.config());
        temp_store.prune(&self.media_file_store).await.ignore();

        Ok(())
    }

    pub(super) async fn storage(&self) -> Result<models::Storage> {
        self.storage
            .perform(|| async {
                let mut conn = self.store.pooled();
                models::Storage::get_for_catalog(&mut conn, &self.media_file_store.catalog).await
            })
            .await
    }

    pub(super) async fn ensure_local(&self) -> Result<PathBuf> {
        self.ensure_local
            .perform(|| async {
                let file_path = self.media_file_store.file(&self.media_file.file_name);
                let temp_store = DiskStore::temp_store(self.store.config());
                let temp_path = temp_store.local_path(&file_path);

                if file_exists(&temp_path).await? {
                    return Ok(temp_path);
                }

                if let Some(parent) = temp_path.parent() {
                    fs::create_dir_all(parent).await?;
                }

                let storage = self.storage().await?;
                let remote_store = storage.file_store(self.store.config()).await?;
                remote_store.pull(&file_path, &temp_path).await?;

                Ok(temp_path)
            })
            .await
    }

    pub(super) async fn decode(&self) -> Result<DynamicImage> {
        self.decode
            .perform(|| async {
                let path = self.ensure_local().await?;
                load_source_image(&path).await
            })
            .await
    }

    pub(super) async fn resize(&self, size: i32) -> Result<DynamicImage> {
        self.resize
            .perform(size, || async {
                let image = self.decode().await?;
                Ok(resize_image(image, size, size).await)
            })
            .await
    }

    pub(super) async fn resize_social(&self) -> Result<DynamicImage> {
        self.social
            .perform(|| async {
                let mut image = self.decode().await?;

                // Target size is 1200 x 630
                let target_aspect = (SOCIAL_WIDTH as f32) / (SOCIAL_HEIGHT as f32);
                let source_aspect = (image.width() as f32) / (image.height() as f32);

                if source_aspect < target_aspect {
                    // Image is too tall. We want to crop off more of the bottom than the top.
                    let target_width = image.width();
                    let target_height = ((target_width as f32) / target_aspect).round() as u32;
                    let diff = image.height() - target_height;
                    let top = diff / 3;
                    image = crop_image(image, 0, top, target_width, target_height).await;
                }

                Ok(resize_image(image, SOCIAL_WIDTH as i32, SOCIAL_HEIGHT as i32).await)
            })
            .await
    }
}
