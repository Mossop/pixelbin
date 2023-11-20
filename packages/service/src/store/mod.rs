//! A basic abstraction around the pixelbin data stores.
use std::{iter::once, path::PathBuf};

use async_trait::async_trait;
use aws::AwsClient;
use diesel::prelude::*;
use diesel_async::{
    scoped_futures::{ScopedBoxFuture, ScopedFutureExt},
    AsyncConnection, RunQueryDsl,
};

pub(crate) mod aws;
pub(crate) mod db;
pub(crate) mod metadata;
pub(crate) mod models;
pub(crate) mod path;

use db::schema::*;
use db::DbConnection;
use db::{connect, DbPool};
use tokio::fs;
use tracing::instrument;

use self::path::{FilePath, PathLike, ResourcePath};
use crate::{Config, Result};

#[async_trait]
pub trait FileStore {
    async fn list_files(&self, prefix: Option<ResourcePath>) -> Result<Vec<(ResourcePath, u64)>>;
}

pub(crate) struct DiskStore {
    pub(crate) root: PathBuf,
}

impl DiskStore {
    fn local_path<P: PathLike>(&self, path: &P) -> PathBuf {
        let mut local_path = self.root.clone();
        for part in path.path_parts() {
            local_path.push(part);
        }

        local_path
    }
}

#[async_trait]
impl FileStore for DiskStore {
    async fn list_files(&self, prefix: Option<ResourcePath>) -> Result<Vec<(ResourcePath, u64)>> {
        let mut files = Vec::<(ResourcePath, u64)>::new();

        let root = if let Some(prefix) = prefix {
            self.local_path(&prefix)
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
        F: for<'b> FnOnce(DbConnection<'b>) -> ScopedBoxFuture<'a, 'b, Result<R>> + Send + 'a,
    {
        let mut conn = self.pool.get().await?;

        cb(DbConnection::from_connection(&mut conn, &self.config)).await
    }

    #[instrument(skip_all)]
    pub async fn in_transaction<'a, R, F>(&self, cb: F) -> Result<R>
    where
        R: 'a + Send,
        F: for<'b> FnOnce(DbConnection<'b>) -> ScopedBoxFuture<'a, 'b, Result<R>> + Send + 'a,
    {
        let mut conn = self.pool.get().await?;

        conn.transaction(|conn| {
            async move { cb(DbConnection::from_transaction(conn, &self.config)).await }
                .scope_boxed()
        })
        .await
    }

    pub(crate) async fn online_uri(
        &self,
        storage: &models::Storage,
        path: &FilePath,
        mimetype: &str,
        filename: Option<&str>,
    ) -> Result<String> {
        let client = AwsClient::from_storage(storage).await?;
        client.file_uri(path, mimetype, filename).await
    }

    pub(crate) async fn list_local_files(&self) -> Result<Vec<(PathBuf, u64)>> {
        let mut files = Vec::<(PathBuf, u64)>::new();

        let mut readers = vec![fs::read_dir(&self.config.local_storage).await?];
        while !readers.is_empty() {
            let reader = readers.last_mut().unwrap();
            match reader.next_entry().await? {
                Some(entry) => {
                    let stats = entry.metadata().await?;
                    if stats.is_dir() {
                        readers.push(fs::read_dir(entry.path()).await?)
                    } else if stats.is_file() {
                        files.push((entry.path(), stats.len()))
                    }
                }
                None => {
                    readers.pop();
                }
            }
        }

        Ok(files)
    }

    pub(crate) async fn list_local_alternate_files(
        &self,
    ) -> Result<Vec<(models::AlternateFile, FilePath, PathBuf)>> {
        let mut conn = self.pool.get().await?;

        let files = alternate_file::table
            .inner_join(media_file::table.on(media_file::id.eq(alternate_file::media_file)))
            .inner_join(media_item::table.on(media_file::media_item.eq(media_item::id)))
            .filter(alternate_file::local.eq(true))
            .select((
                alternate_file::all_columns,
                media_item::id,
                media_item::catalog,
            ))
            .load::<(models::AlternateFile, String, String)>(&mut conn)
            .await?;

        Ok(files
            .into_iter()
            .map(|(alternate, media_item, catalog)| {
                let file_path = FilePath {
                    catalog: catalog.clone(),
                    item: media_item,
                    file: alternate.media_file.clone(),
                    file_name: alternate.file_name.clone(),
                };
                let local_path = self.config.local_path(&file_path);
                (alternate, file_path, local_path)
            })
            .collect())
    }
}
