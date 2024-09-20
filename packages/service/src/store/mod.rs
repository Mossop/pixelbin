//! A basic abstraction around the pixelbin data stores.
use std::future::Future;

pub(crate) mod aws;
pub(crate) mod db;
pub(crate) mod file;
pub(crate) mod path;

pub(crate) use db::models;
use db::{connect, DbConnection};
use tracing::span::Id;

use crate::{
    store::db::{Connection, SqlxPool},
    Config, Result, Task, TaskQueue,
};

#[derive(Default, Debug, Clone, Copy, PartialEq)]
pub enum Isolation {
    #[default]
    Committed,
    Repeatable,
    ReadOnly,
}

#[derive(Clone)]
pub struct Store {
    config: Config,
    pool: SqlxPool,
    task_queue: TaskQueue,
}

impl Store {
    pub async fn new(config: Config, task_span: Option<Id>) -> Result<Self> {
        let (pool, task_queue) = connect(&config, task_span).await?;

        Ok(Store {
            task_queue,
            config,
            pool,
        })
    }

    pub fn connect(&self) -> impl Future<Output = Result<DbConnection<'static>>> {
        DbConnection::new(
            self.pool.clone(),
            self.config.clone(),
            self.task_queue.clone(),
        )
    }

    pub async fn queue_task(&self, task: Task) {
        self.task_queue.queue_task(task).await;
    }

    pub async fn finish_tasks(&self) {
        self.task_queue.finish_tasks().await;
    }

    pub(crate) fn config(&self) -> &Config {
        &self.config
    }

    pub async fn isolated<'a, 'c>(&'c self, level: Isolation) -> Result<DbConnection<'a>>
    where
        'c: 'a,
    {
        let inner = self.pool.begin().await?;

        Ok(DbConnection {
            connection: Connection::Transaction((level, inner)),
            pool: self.pool.clone(),
            config: self.config.clone(),
            task_queue: self.task_queue.clone(),
        })
    }
}
