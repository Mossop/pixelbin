//! A basic abstraction around the pixelbin data stores.
use std::{
    io::ErrorKind,
    iter::once,
    path::{Path, PathBuf},
};

use async_trait::async_trait;
use diesel_async::{
    scoped_futures::{ScopedBoxFuture, ScopedFutureExt},
    AsyncConnection,
};

pub(crate) mod aws;
pub(crate) mod db;
pub(crate) mod path;

pub(crate) use db::models;
use db::{connect, DbConnection, DbPool};
use mime::Mime;
use tempfile::NamedTempFile;
use tokio::fs;
use tracing::instrument;

use self::path::{FilePath, PathLike, ResourcePath};
use crate::{Config, Result};

#[async_trait]
pub trait FileStore {
    async fn list_files(&self, prefix: Option<&ResourcePath>) -> Result<Vec<(ResourcePath, u64)>>;

    async fn delete(&self, path: &ResourcePath) -> Result;

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

    pub(crate) async fn copy_from_temp(&self, temp_file: NamedTempFile, path: &FilePath) -> Result {
        let target = self.local_path(path);

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).await?;
        }

        temp_file
            .persist(target)
            .map_err(|e| crate::Error::Unknown {
                message: e.to_string(),
            })?;

        Ok(())
    }
}

#[async_trait]
impl FileStore for DiskStore {
    async fn list_files(&self, prefix: Option<&ResourcePath>) -> Result<Vec<(ResourcePath, u64)>> {
        let mut files = Vec::<(ResourcePath, u64)>::new();

        let root = if let Some(prefix) = prefix {
            self.local_path(prefix)
        } else {
            self.root.clone()
        };

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
                            files.push((path, stats.len()));
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

    async fn delete(&self, path: &ResourcePath) -> Result {
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

    async fn pull(&self, path: &FilePath, target: &Path) -> Result {
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).await?;
        }

        let local = self.local_path(path);

        fs::copy(local, target).await?;

        Ok(())
    }

    async fn push(&self, source: &Path, path: &FilePath, _mimetype: &Mime) -> Result {
        let target = self.local_path(path);

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).await?;
        }

        fs::copy(source, target).await?;

        Ok(())
    }
}

#[derive(Clone)]
pub struct Store {
    config: Config,
    pool: DbPool,
}

impl Store {
    pub async fn new(config: Config) -> Result<Self> {
        Ok(Store {
            pool: connect(&config).await?,
            config,
        })
    }

    pub(crate) fn config(&self) -> &Config {
        &self.config
    }

    #[instrument(skip_all)]
    pub async fn with_connection<'a, R, F>(&self, cb: F) -> Result<R>
    where
        R: 'a + Send,
        F: for<'b> FnOnce(&'b mut DbConnection<'b>) -> ScopedBoxFuture<'a, 'b, Result<R>>
            + Send
            + 'a,
    {
        let mut conn = self.pool.get().await?;

        let mut db_conn = DbConnection::from_connection(&mut conn, &self.config);
        cb(&mut db_conn).await
    }

    #[instrument(skip_all)]
    pub async fn in_transaction<'a, R, F>(&self, cb: F) -> Result<R>
    where
        R: 'a + Send,
        F: for<'b> FnOnce(&'b mut DbConnection<'b>) -> ScopedBoxFuture<'a, 'b, Result<R>>
            + Send
            + 'a,
    {
        let mut conn = self.pool.get().await?;

        conn.transaction(|conn| {
            async move {
                let mut db_conn = DbConnection::from_transaction(conn, &self.config);
                cb(&mut db_conn).await
            }
            .scope_boxed()
        })
        .await
    }
}
