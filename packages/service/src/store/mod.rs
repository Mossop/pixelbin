//! A basic abstraction around the pixelbin data stores.
use std::{
    collections::HashMap,
    fmt,
    io::ErrorKind,
    iter::once,
    path::{Path, PathBuf},
};

use async_trait::async_trait;
use diesel_async::scoped_futures::ScopedBoxFuture;

pub(crate) mod aws;
pub(crate) mod db;
pub(crate) mod path;

pub(crate) use db::models;
use db::{connect, DbConnection, DbPool};
use mime::Mime;
use scoped_futures::ScopedFutureExt;
use tempfile::TempPath;
use tokio::fs;
use tracing::{instrument, span::Id};

use self::path::{FilePath, PathLike, ResourcePath};
use crate::{shared::error::Ignorable, Config, Result, Task, TaskQueue};

#[async_trait]
pub trait FileStore {
    async fn list_files<P>(&self, prefix: Option<&P>) -> Result<HashMap<ResourcePath, u64>>
    where
        P: PathLike + Send + Sync + fmt::Debug;

    async fn exists(&self, path: &FilePath) -> Result<bool>;

    async fn prune<P>(&self, path: &P) -> Result
    where
        P: PathLike + Send + Sync + fmt::Debug;

    async fn delete<P>(&self, path: &P) -> Result
    where
        P: PathLike + Send + Sync + fmt::Debug;

    async fn pull(&self, path: &FilePath, target: &Path) -> Result;

    async fn push(&self, source: &Path, path: &FilePath, mimetype: &Mime) -> Result;
}

pub(crate) struct DiskStore {
    pub(crate) root: PathBuf,
}

impl DiskStore {
    pub(crate) fn local_path<P: PathLike>(&self, path: &P) -> PathBuf {
        let mut local_path = self.root.clone();
        for part in path.path_parts() {
            local_path.push(part);
        }

        local_path
    }

    #[instrument(level = "trace", skip(self, temp_file), err)]
    pub(crate) async fn copy_from_temp(&self, temp_file: TempPath, path: &FilePath) -> Result {
        let target = self.local_path(path);

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).await?;
        }

        let source = temp_file.to_path_buf();

        if fs::hard_link(&source, &target).await.is_err() {
            fs::copy(&source, &target)
                .await
                .map_err(|e| crate::Error::Unknown {
                    message: e.to_string(),
                })?;
        }

        Ok(())
    }

    async fn prune_path(path: &Path) -> Result<bool> {
        let mut reader = match fs::read_dir(path).await {
            Ok(r) => r,
            Err(e) => {
                if e.kind() == ErrorKind::NotFound {
                    return Ok(true);
                } else {
                    return Err(e.into());
                }
            }
        };
        let mut can_prune = true;

        while let Some(entry) = reader.next_entry().await? {
            let stats = entry.metadata().await?;
            if stats.is_dir() {
                if !Box::pin(Self::prune_path(&entry.path())).await? {
                    can_prune = false;
                }
            } else {
                can_prune = false;
            }
        }

        if can_prune {
            fs::remove_dir(path).await.ignore();
        }

        Ok(can_prune)
    }
}

#[async_trait]
impl FileStore for DiskStore {
    async fn exists(&self, path: &FilePath) -> Result<bool> {
        Ok(fs::try_exists(self.local_path(path)).await?)
    }

    #[allow(clippy::blocks_in_conditions)]
    #[instrument(skip(self), err)]
    async fn list_files<P>(&self, prefix: Option<&P>) -> Result<HashMap<ResourcePath, u64>>
    where
        P: PathLike + Send + Sync + fmt::Debug,
    {
        let mut files = HashMap::<ResourcePath, u64>::new();

        let root = if let Some(prefix) = prefix {
            self.local_path(prefix)
        } else {
            self.root.clone()
        };

        match fs::metadata(&root).await {
            Ok(metadata) => {
                if metadata.is_file() {
                    if let Some(prefix) = prefix {
                        if let Ok(path) = ResourcePath::try_from(prefix.path_parts()) {
                            files.insert(path, metadata.len());
                        }
                    }
                    return Ok(files);
                }
            }
            Err(err) => {
                if err.kind() == ErrorKind::NotFound {
                    return Ok(files);
                }
                return Err(err.into());
            }
        }

        let mut path_parts: Vec<String> = root
            .strip_prefix(&self.root)
            .unwrap()
            .components()
            .map(|c| c.as_os_str().to_str().unwrap().to_owned())
            .collect();

        let mut readers = vec![fs::read_dir(root).await?];
        while !readers.is_empty() {
            let reader = readers.last_mut().unwrap();
            match reader.next_entry().await? {
                Some(entry) => {
                    let name = if let Ok(name) = entry.file_name().into_string() {
                        name
                    } else {
                        continue;
                    };

                    let stats = entry.metadata().await?;
                    if stats.is_dir() {
                        readers.push(fs::read_dir(entry.path()).await?);
                        path_parts.push(name);
                    } else if stats.is_file() {
                        let all_parts = path_parts
                            .iter()
                            .map(|s| s.as_str())
                            .chain(once(name.as_str()));

                        if let Ok(path) = ResourcePath::try_from(all_parts) {
                            files.insert(path, stats.len());
                        }
                    }
                }
                None => {
                    readers.pop();
                    path_parts.pop();
                }
            }
        }

        Ok(files)
    }

    #[allow(clippy::blocks_in_conditions)]
    #[instrument(skip(self), err)]
    async fn prune<P>(&self, path: &P) -> Result
    where
        P: PathLike + Send + Sync + fmt::Debug,
    {
        Self::prune_path(&self.local_path(path)).await?;

        Ok(())
    }

    #[allow(clippy::blocks_in_conditions)]
    #[instrument(skip(self), err)]
    async fn delete<P>(&self, path: &P) -> Result
    where
        P: PathLike + Send + Sync + fmt::Debug,
    {
        let local = self.local_path(path);

        let stats = match fs::metadata(&local).await {
            Ok(s) => s,
            Err(e) => {
                if e.kind() == ErrorKind::NotFound {
                    return Ok(());
                }

                return Err(e.into());
            }
        };

        if stats.is_dir() {
            fs::remove_dir_all(&local).await?;
        } else {
            fs::remove_file(&local).await?;
        }

        Ok(())
    }

    #[allow(clippy::blocks_in_conditions)]
    #[instrument(skip(self), err)]
    async fn pull(&self, path: &FilePath, target: &Path) -> Result {
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).await?;
        }

        let local = self.local_path(path);

        fs::copy(local, target).await?;

        Ok(())
    }

    #[allow(clippy::blocks_in_conditions)]
    #[instrument(skip(self), err)]
    async fn push(&self, source: &Path, path: &FilePath, _mimetype: &Mime) -> Result {
        let target = self.local_path(path);

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).await?;
        }

        fs::copy(source, target).await?;

        Ok(())
    }
}

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
    pool: DbPool,
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

    pub async fn connect(self) -> Result<DbConnection<'static>> {
        DbConnection::new(self.pool.clone(), &self.config, &self.task_queue).await
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

    pub async fn with_connection<'a, R, F>(&self, cb: F) -> Result<R>
    where
        R: 'a + Send,
        F: for<'b> FnOnce(&'b mut DbConnection<'b>) -> ScopedBoxFuture<'a, 'b, Result<R>>
            + Send
            + 'a,
    {
        let mut db_conn =
            DbConnection::new(self.pool.clone(), &self.config, &self.task_queue).await?;
        cb(&mut db_conn).await
    }

    pub async fn isolated<'a, R, F>(&self, level: Isolation, cb: F) -> Result<R>
    where
        R: 'a + Send,
        F: for<'b> FnOnce(&'b mut DbConnection<'b>) -> ScopedBoxFuture<'a, 'b, Result<R>>
            + Send
            + 'a,
    {
        let mut db_conn =
            DbConnection::new(self.pool.clone(), &self.config, &self.task_queue).await?;
        db_conn
            .isolated(level, |conn| async move { cb(conn).await }.scope_boxed())
            .await
    }

    pub async fn in_transaction<'a, R, F>(&self, cb: F) -> Result<R>
    where
        R: 'a + Send,
        F: for<'b> FnOnce(&'b mut DbConnection<'b>) -> ScopedBoxFuture<'a, 'b, Result<R>>
            + Send
            + 'a,
    {
        self.isolated(Default::default(), cb).await
    }
}
