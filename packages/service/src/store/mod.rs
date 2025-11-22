//! A basic abstraction around the pixelbin data stores.
use std::{
    fmt,
    future::Future,
    ops::Deref,
    sync::{Arc, OnceLock},
};

pub(crate) mod aws;
pub(crate) mod db;
pub(crate) mod file;
pub(crate) mod locks;
pub(crate) mod path;

pub(crate) use db::models;
use db::{DbConnection, connect};

use crate::{
    Config, Isolation, Result, Task, TaskQueue,
    store::{db::DbPool, locks::Locks},
};

#[derive(Default, Clone, Copy, Debug, PartialEq, Eq)]
pub enum StoreType {
    #[default]
    Cli,
    Server,
}

struct LazyInit<T> {
    inner: Arc<OnceLock<T>>,
}

impl<T> Clone for LazyInit<T> {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
        }
    }
}

impl<T> LazyInit<T> {
    fn new() -> Self {
        Self {
            inner: Arc::new(OnceLock::new()),
        }
    }

    fn init(&self, value: T) {
        let _ = self.inner.set(value);
    }
}

impl<T> Deref for LazyInit<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        self.inner.get().unwrap()
    }
}

#[derive(Clone)]
pub struct Store {
    store_type: StoreType,
    config: Config,
    pool: DbPool,
    task_queue: LazyInit<TaskQueue>,
    locks: LazyInit<Locks>,
}

impl fmt::Debug for Store {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.config.fmt(f)
    }
}

impl Store {
    pub(crate) fn store_type(&self) -> StoreType {
        self.store_type
    }

    pub(crate) fn with_pool(&self, pool: DbPool) -> Self {
        Store {
            store_type: self.store_type,
            pool,
            task_queue: self.task_queue.clone(),
            config: self.config.clone(),
            locks: self.locks.clone(),
        }
    }

    pub async fn new(config: Config, store_type: StoreType) -> Result<Self> {
        connect(&config, store_type).await
    }

    pub fn pooled(&self) -> DbConnection<'static> {
        DbConnection::pooled(self.clone())
    }

    pub fn connect(&self) -> impl Future<Output = Result<DbConnection<'static>>> {
        DbConnection::connect(self.clone())
    }

    pub(crate) fn locks(&self) -> &Locks {
        &self.locks
    }

    pub fn queue_task(&self, task: Task) {
        self.task_queue.queue_task(task);
    }

    pub async fn shutdown(&self) {
        self.task_queue.finish_tasks().await;
    }

    pub fn config(&self) -> &Config {
        &self.config
    }

    pub async fn isolated<'a, 'c>(&'c self, level: Isolation) -> Result<DbConnection<'a>>
    where
        'c: 'a,
    {
        let tx = self.pool.begin().await?;
        Ok(DbConnection::from_transaction(self.clone(), level, tx))
    }
}
