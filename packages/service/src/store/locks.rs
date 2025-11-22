//! Locks for various resources in the store to prevent concurrent work on the same resource by
//! multiple tasks.
use std::{
    collections::HashMap,
    sync::{Arc, Mutex, Weak},
};

use tokio::sync::{OwnedSemaphorePermit, Semaphore};

use crate::{
    Store,
    store::{models, path::MediaFileStore},
    task_queue::opcache::MediaFileOpCache,
};

#[derive(Default)]
struct Inner {
    file_ops: HashMap<MediaFileStore, Weak<MediaFileOpCache>>,
}

#[derive(Clone)]
pub(crate) struct Locks {
    store: Store,
    expensive_tasks: Arc<Semaphore>,
    inner: Arc<Mutex<Inner>>,
}

impl Locks {
    pub(super) fn new(store: &Store) -> Self {
        Self {
            store: store.clone(),
            expensive_tasks: Arc::new(Semaphore::new(1)),
            inner: Default::default(),
        }
    }

    pub(crate) async fn enter_expensive_task(&self) -> OwnedSemaphorePermit {
        self.expensive_tasks.clone().acquire_owned().await.unwrap()
    }

    pub(crate) fn media_file_ops(
        &self,
        media_file: &models::MediaFile,
        media_file_store: &MediaFileStore,
    ) -> Arc<MediaFileOpCache> {
        let mut inner = self.inner.lock().unwrap();

        if let Some(op_cache) = inner
            .file_ops
            .get(media_file_store)
            .and_then(|w| w.upgrade())
        {
            op_cache
        } else {
            let op_cache = Arc::new(MediaFileOpCache::new(
                self.store.clone(),
                media_file,
                media_file_store,
            ));

            inner
                .file_ops
                .insert(media_file_store.clone(), Arc::downgrade(&op_cache));

            op_cache
        }
    }

    pub(crate) fn clear_file_ops(&self) {
        let mut inner = self.inner.lock().unwrap();
        inner.file_ops.retain(|_, v| v.strong_count() > 0);
    }
}
