#![deny(unreachable_pub)]
//! A basic abstraction around the pixelbin data stores.
use std::path::PathBuf;

use async_trait::async_trait;
use aws::AwsClient;
use diesel::prelude::*;
use diesel_async::{
    scoped_futures::{ScopedBoxFuture, ScopedFutureExt},
    AsyncConnection, RunQueryDsl,
};

mod aws;
mod db;
pub mod models;
#[allow(unreachable_pub)]
mod schema;

pub use aws::RemotePath;
pub use db::DbQueries;
use db::{connect, sealed::ConnectionProvider, DbConnection, DbPool};
use pixelbin_shared::{Config, Result};
use schema::*;
use tokio::fs;
use tracing::instrument;

pub(crate) fn joinable(st: &str) -> &str {
    st.trim_matches('/')
}

#[derive(Clone)]
pub struct Store {
    config: Config,
    pool: DbPool,
}

#[derive(Queryable, Clone, Debug)]
pub struct LocalAlternateFile {
    pub id: String,
    pub file_type: models::AlternateFileType,
    #[diesel(serialize_as = String, deserialize_as = String)]
    pub path: PathBuf,
    pub file_size: i32,
    pub mimetype: String,
    pub width: i32,
    pub height: i32,
    pub duration: Option<f32>,
    pub frame_rate: Option<f32>,
    pub bit_rate: Option<f32>,
    pub media_file: String,
    pub media_info: String,
    pub catalog: String,
}

#[derive(Clone, Debug)]
pub struct MediaFilePath {
    pub catalog: String,
    pub media_item: String,
    pub media_file: String,
}

impl MediaFilePath {
    fn new(catalog: &str, media_item: &str, media_file: &str) -> Self {
        Self {
            catalog: catalog.to_owned(),
            media_item: media_item.to_owned(),
            media_file: media_file.to_owned(),
        }
    }

    fn local_path(&self) -> PathBuf {
        PathBuf::new()
            .join(joinable(&self.catalog))
            .join(joinable(&self.media_item))
            .join(joinable(&self.media_file))
    }

    fn remote_path(&self) -> RemotePath {
        let mut path = RemotePath::new();
        path.push(joinable(&self.catalog));
        path.push(joinable(&self.media_item));
        path.push(joinable(&self.media_file));
        path
    }
}

impl Store {
    pub async fn new(config: Config) -> Result<Self> {
        Ok(Store {
            pool: connect(&config.database_url).await?,
            config,
        })
    }

    pub fn config(&self) -> &Config {
        &self.config
    }

    #[instrument(skip_all)]
    pub async fn in_transaction<'a, R, F>(&self, cb: F) -> Result<R>
    where
        R: 'a + Send,
        F: for<'b> FnOnce(Transaction<'b>) -> ScopedBoxFuture<'a, 'b, Result<R>> + Send + 'a,
    {
        let mut conn = self.pool.get().await?;

        conn.transaction(|conn| {
            async move {
                cb(Transaction {
                    connection: conn,
                    config: self.config.clone(),
                })
                .await
            }
            .scope_boxed()
        })
        .await
    }

    pub async fn online_uri(
        &self,
        storage: &models::Storage,
        path: &RemotePath,
        mimetype: &str,
    ) -> Result<String> {
        let client = AwsClient::from_storage(storage).await?;
        client.file_uri(path, mimetype).await
    }

    pub async fn list_online_alternate_files(
        &self,
        storage: &models::Storage,
    ) -> Result<Vec<(models::AlternateFile, MediaFilePath, RemotePath)>> {
        let mut conn = self.pool.get().await?;

        let files = alternate_file::table
            .inner_join(media_file::table.on(media_file::id.eq(alternate_file::media_file)))
            .inner_join(media_item::table.on(media_file::media.eq(media_item::id)))
            .inner_join(catalog::table.on(media_item::catalog.eq(catalog::id)))
            .filter(alternate_file::local.eq(false))
            .filter(catalog::storage.eq(&storage.id))
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
                let file_path = MediaFilePath::new(&catalog, &media_item, &alternate.media_file);
                let remote_path = file_path.remote_path().join(&alternate.file_name);
                (alternate, file_path, remote_path)
            })
            .collect())
    }

    pub async fn list_online_media_files(
        &self,
        storage: &models::Storage,
    ) -> Result<Vec<(models::MediaFile, MediaFilePath, RemotePath)>> {
        let mut conn = self.pool.get().await?;

        let files = media_file::table
            .inner_join(media_item::table.on(media_file::media.eq(media_item::id)))
            .inner_join(catalog::table.on(media_item::catalog.eq(catalog::id)))
            .filter(catalog::storage.eq(&storage.id))
            .select((media_file::all_columns, media_item::catalog))
            .load::<(models::MediaFile, String)>(&mut conn)
            .await?;

        Ok(files
            .into_iter()
            .map(|(media_file, catalog)| {
                let file_path = MediaFilePath::new(&catalog, &media_file.media, &media_file.id);
                let remote_path = file_path.remote_path().join(&media_file.file_name);
                (media_file, file_path, remote_path)
            })
            .collect())
    }

    pub async fn list_local_files(&self) -> Result<Vec<(PathBuf, u64)>> {
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

    pub async fn list_local_alternate_files(
        &self,
    ) -> Result<Vec<(models::AlternateFile, MediaFilePath, PathBuf)>> {
        let mut conn = self.pool.get().await?;

        let files = alternate_file::table
            .inner_join(media_file::table.on(media_file::id.eq(alternate_file::media_file)))
            .inner_join(media_item::table.on(media_file::media.eq(media_item::id)))
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
                let file_path = MediaFilePath::new(&catalog, &media_item, &alternate.media_file);
                let local_path = self
                    .config
                    .local_storage
                    .join(file_path.local_path())
                    .join(joinable(&alternate.file_name));
                (alternate, file_path, local_path)
            })
            .collect())
    }
}

#[async_trait]
impl ConnectionProvider for Store {
    async fn with_connection<'a, R, F>(&mut self, cb: F) -> Result<R>
    where
        R: 'a,
        F: for<'b> FnOnce(&'b mut DbConnection) -> ScopedBoxFuture<'a, 'b, Result<R>> + Send + 'a,
    {
        let mut conn = self.pool.get().await?;
        cb(&mut conn).await
    }

    fn config(&self) -> Config {
        self.config.clone()
    }
}

pub struct Transaction<'a> {
    connection: &'a mut DbConnection,
    config: Config,
}

#[async_trait]
impl<'t> ConnectionProvider for Transaction<'t> {
    async fn with_connection<'a, R, F>(&mut self, cb: F) -> Result<R>
    where
        R: 'a,
        F: for<'b> FnOnce(&'b mut DbConnection) -> ScopedBoxFuture<'a, 'b, Result<R>> + Send + 'a,
    {
        cb(self.connection).await
    }

    fn config(&self) -> Config {
        self.config.clone()
    }
}

impl<'a> Transaction<'a> {
    pub async fn update_searches(&mut self, catalog: &str) -> Result {
        self.with_connection(|conn| {
            async move {
                let searches = saved_search::table
                    .filter(saved_search::catalog.eq(catalog))
                    .select(saved_search::all_columns)
                    .load::<models::SavedSearch>(conn)
                    .await?;

                for search in searches {
                    search.update(conn).await?;
                }

                Ok(())
            }
            .scope_boxed()
        })
        .await
    }
}
