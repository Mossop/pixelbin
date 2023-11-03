#![deny(unreachable_pub)]
//! A basic abstraction around the pixelbin data stores.
use std::path::PathBuf;

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
pub use db::DbConnection;
use db::{connect, DbPool};
use pixelbin_shared::{Config, Result};
use schema::*;
use tokio::fs;
use tracing::instrument;

pub(crate) fn joinable(st: &str) -> &str {
    st.trim_matches('/')
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

#[derive(Clone)]
pub struct Store {
    config: Config,
    pool: DbPool,
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
    pub async fn with_connection<'a, R, F>(&self, cb: F) -> Result<R>
    where
        R: 'a + Send,
        F: for<'b> FnOnce(DbConnection<'b>) -> ScopedBoxFuture<'a, 'b, Result<R>> + Send + 'a,
    {
        let mut conn = self.pool.get().await?;

        cb(DbConnection {
            conn: &mut conn,
            config: self.config.clone(),
        })
        .await
    }

    #[instrument(skip_all)]
    pub async fn in_transaction<'a, R, F>(&self, cb: F) -> Result<R>
    where
        R: 'a + Send,
        F: for<'b> FnOnce(DbConnection<'b>) -> ScopedBoxFuture<'a, 'b, Result<R>> + Send + 'a,
    {
        let mut conn = self.pool.get().await?;

        conn.transaction(|conn| {
            async move {
                cb(DbConnection {
                    conn,
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
