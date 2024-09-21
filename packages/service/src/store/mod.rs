//! A basic abstraction around the pixelbin data stores.
use std::{
    future::Future,
    ops::{Deref, DerefMut},
    sync::Arc,
};

pub(crate) mod aws;
pub(crate) mod db;
pub(crate) mod file;
pub(crate) mod path;

pub(crate) use db::models;
use db::{connect, DbConnection};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use tracing::span::Id;

use crate::{store::db::SqlxPool, Config, Isolation, Result, Task, TaskQueue};

#[derive(Clone, Debug)]
struct StoreInner {
    config: Config,
    pool: SqlxPool,
    task_queue: TaskQueue,
    expensive_tasks: Arc<Semaphore>,
}

impl From<StoreInner> for Store {
    fn from(inner: StoreInner) -> Self {
        Store {
            pooled: DbConnection::pooled(inner.clone()),
            inner,
        }
    }
}

#[derive(Debug)]
pub struct Store {
    inner: StoreInner,
    pooled: DbConnection<'static>,
}

impl Clone for Store {
    fn clone(&self) -> Self {
        self.inner.clone().into()
    }
}

impl Store {
    pub async fn new(config: Config, task_span: Option<Id>) -> Result<Self> {
        connect(&config, task_span).await
    }

    pub fn pooled(&self) -> DbConnection<'static> {
        DbConnection::pooled(self.inner.clone())
    }

    pub fn connect(&self) -> impl Future<Output = Result<DbConnection<'static>>> {
        DbConnection::connect(self.inner.clone())
    }

    pub(crate) async fn enter_expensive_task(&self) -> OwnedSemaphorePermit {
        self.inner
            .expensive_tasks
            .clone()
            .acquire_owned()
            .await
            .unwrap()
    }

    pub async fn queue_task(&self, task: Task) {
        self.inner.task_queue.queue_task(task).await;
    }

    pub async fn finish_tasks(&self) {
        self.inner.task_queue.finish_tasks().await;
    }

    pub(crate) fn config(&self) -> &Config {
        &self.inner.config
    }

    pub async fn isolated<'a, 'c>(&'c self, level: Isolation) -> Result<DbConnection<'a>>
    where
        'c: 'a,
    {
        let tx = self.inner.pool.begin().await?;
        Ok(DbConnection::from_transaction(self.clone(), level, tx))
    }
}

impl Deref for Store {
    type Target = DbConnection<'static>;

    fn deref(&self) -> &DbConnection<'static> {
        &self.pooled
    }
}

impl DerefMut for Store {
    fn deref_mut(&mut self) -> &mut DbConnection<'static> {
        &mut self.pooled
    }
}
