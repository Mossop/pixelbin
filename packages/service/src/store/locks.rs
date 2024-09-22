use std::{
    collections::HashMap,
    ops::Deref,
    sync::{Arc, Mutex, Weak},
};

use tokio::sync::{OwnedSemaphorePermit, Semaphore};

use crate::store::path::MediaItemStore;

pub(crate) struct ResourceLock<T> {
    resource: Arc<T>,
}

impl<T> ResourceLock<T> {
    fn new(resource: T) -> Self {
        Self {
            resource: Arc::new(resource),
        }
    }

    pub(crate) async fn for_update(self: &Arc<Self>) -> ResourceGuard<T> {
        ResourceGuard { lock: self.clone() }
    }

    pub(crate) async fn for_delete(self: &Arc<Self>) -> ResourceGuard<T> {
        ResourceGuard { lock: self.clone() }
    }
}

pub(crate) struct ResourceGuard<T> {
    lock: Arc<ResourceLock<T>>,
}

impl<T> Deref for ResourceGuard<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.lock.resource
    }
}

#[derive(Default)]
struct Inner {
    media_items: HashMap<String, Weak<ResourceLock<MediaItemLock>>>,
}

#[derive(Clone)]
pub(crate) struct Locks {
    expensive_tasks: Arc<Semaphore>,
    inner: Arc<Mutex<Inner>>,
}

impl Locks {
    pub(super) fn new() -> Self {
        Self {
            expensive_tasks: Arc::new(Semaphore::new(1)),
            inner: Default::default(),
        }
    }

    pub(crate) async fn enter_expensive_task(&self) -> OwnedSemaphorePermit {
        self.expensive_tasks.clone().acquire_owned().await.unwrap()
    }

    pub(crate) fn media_item(
        &self,
        media_item_store: &MediaItemStore,
    ) -> Arc<ResourceLock<MediaItemLock>> {
        let mut inner = self.inner.lock().unwrap();

        if let Some(lock) = inner
            .media_items
            .get(&media_item_store.item)
            .and_then(|w| w.upgrade())
        {
            lock
        } else {
            let lock = Arc::new(ResourceLock::new(MediaItemLock {
                locks: self.clone(),
                store: media_item_store.clone(),
            }));

            inner
                .media_items
                .insert(media_item_store.item.clone(), Arc::downgrade(&lock));

            lock
        }
    }
}

pub(crate) struct MediaItemLock {
    locks: Locks,
    store: MediaItemStore,
}

impl Drop for MediaItemLock {
    fn drop(&mut self) {
        if let Ok(mut inner) = self.locks.inner.lock() {
            inner.media_items.remove(&self.store.item);
        }
    }
}
