//! The opcache for media file operations. This ensures that if multiple concurrent tasks are
//! processing the same media file they don't repeat the same operations unnecessarily.
use std::{collections::HashMap, future::Future, hash::Hash, path::PathBuf, result, sync::Arc};

use futures::TryFutureExt;
use image::DynamicImage;
use pixelbin_shared::Error;
use tokio::{
    fs,
    sync::{Mutex, OnceCell},
};
use tracing::trace;

use crate::{
    Result, Store,
    metadata::{crop_image, load_source_image, resize_image},
    shared::file_exists,
    store::{
        file::{DiskStore, FileStore},
        models,
        path::MediaFileStore,
    },
};

const SOCIAL_WIDTH: u32 = 1200;
const SOCIAL_HEIGHT: u32 = 630;

struct Task<R> {
    cell: OnceCell<result::Result<Arc<R>, Error>>,
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
    async fn perform<Fn, Fut>(&self, cb: Fn) -> Result<Arc<R>>
    where
        Fut: Future<Output = Result<R>>,
        Fn: FnOnce() -> Fut,
    {
        let result = self.cell.get_or_init(|| cb().map_ok(Arc::new)).await;

        match result {
            Ok(r) => Ok(r.clone()),
            Err(e) => Err(Error::TaskError {
                message: e.to_string(),
            }),
        }
    }
}

#[derive(Default)]
struct Tasks<P, R> {
    tasks: Mutex<HashMap<P, Arc<Task<R>>>>,
}

impl<P, R> Tasks<P, R>
where
    P: Eq + Hash,
    R: Clone,
{
    async fn perform<Fn, Fut>(&self, params: P, cb: Fn) -> Result<Arc<R>>
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

pub(crate) struct MediaFileOpCache {
    store: Store,
    pub(super) media_file: models::MediaFile,
    pub(super) media_file_store: MediaFileStore,

    storage: Task<models::Storage>,
    ensure_local: Task<PathBuf>,
    decode: Task<DynamicImage>,
    social: Task<DynamicImage>,
    resize: Tasks<i32, DynamicImage>,
}

impl Drop for MediaFileOpCache {
    fn drop(&mut self) {
        trace!(
            media_file = self.media_file_store.file,
            "Dropped MediaFileOpCache"
        );
        self.store.locks().clear_file_ops();
        self.store.queue_task(super::Task::CleanMediaFile {
            media_file: self.media_file.id.clone(),
        });
    }
}

impl MediaFileOpCache {
    pub(crate) fn new(
        store: Store,
        media_file: &models::MediaFile,
        media_file_store: &MediaFileStore,
    ) -> Self {
        Self {
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

    pub(super) async fn storage(&self) -> Result<models::Storage> {
        self.storage
            .perform(|| async {
                let mut conn = self.store.pooled();
                models::Storage::get_for_catalog(&mut conn, &self.media_file_store.catalog).await
            })
            .map_ok(Arc::unwrap_or_clone)
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
                let remote_store = storage.file_store(&self.store).await?;
                remote_store.pull(&file_path, &temp_path).await?;

                Ok(temp_path)
            })
            .map_ok(Arc::unwrap_or_clone)
            .await
    }

    pub(super) async fn decode(&self) -> Result<Arc<DynamicImage>> {
        self.decode
            .perform(|| async {
                let path = self.ensure_local().await?;
                load_source_image(&path).await
            })
            .await
    }

    pub(super) async fn resize(&self, size: i32) -> Result<Arc<DynamicImage>> {
        self.resize
            .perform(size, || async {
                let image = self.decode().await?;
                Ok(resize_image(image, size, size).await)
            })
            .await
    }

    pub(super) async fn resize_social(&self) -> Result<Arc<DynamicImage>> {
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
                    image = Arc::new(crop_image(image, 0, top, target_width, target_height).await);
                }

                Ok(resize_image(image, SOCIAL_WIDTH as i32, SOCIAL_HEIGHT as i32).await)
            })
            .await
    }
}
