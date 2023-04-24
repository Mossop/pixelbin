#![deny(unreachable_pub)]
//! A basic abstraction around the pixelbin data stores.
use std::path::PathBuf;

use aws::AwsClient;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

mod aws;
mod db;
mod models;
#[allow(unreachable_pub)]
mod schema;

pub use aws::RemotePath;
use db::{connect, DbPool};
use models::{AlternateFile, Storage};
pub use models::{AlternateFileType, MediaFile, Orientation};
use pixelbin_shared::{Config, Result};
use schema::*;
use tokio::fs;

fn joinable(st: &str) -> &str {
    st.trim_matches('/')
}

#[derive(Clone)]
pub struct Store {
    config: Config,
    pool: DbPool,
}

#[derive(Clone, Debug)]
pub struct StoreStats {
    pub users: u32,
    pub catalogs: u32,
    pub albums: u32,
    pub tags: u32,
    pub people: u32,
    pub media: u32,
    pub files: u32,
    pub alternate_files: u32,
}

#[derive(Queryable, Clone, Debug)]
pub struct LocalAlternateFile {
    pub id: String,
    pub file_type: AlternateFileType,
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
    catalog: String,
    media_item: String,
    media_file: String,
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

    pub async fn online_uri(
        &self,
        storage: &Storage,
        path: &RemotePath,
        mimetype: &str,
    ) -> Result<String> {
        let client = AwsClient::from_storage(storage).await?;
        client.file_uri(path, mimetype).await
    }

    pub async fn stats(&self) -> Result<StoreStats> {
        let mut conn = self.pool.get().await?;

        let users: i64 = user::table.count().get_result(&mut conn).await?;
        let catalogs: i64 = catalog::table.count().get_result(&mut conn).await?;
        let albums: i64 = album::table.count().get_result(&mut conn).await?;
        let tags: i64 = tag::table.count().get_result(&mut conn).await?;
        let people: i64 = person::table.count().get_result(&mut conn).await?;
        let media: i64 = media_item::table.count().get_result(&mut conn).await?;
        let files: i64 = media_file::table.count().get_result(&mut conn).await?;
        let alternate_files: i64 = alternate_file::table.count().get_result(&mut conn).await?;

        Ok(StoreStats {
            users: users as u32,
            catalogs: catalogs as u32,
            albums: albums as u32,
            tags: tags as u32,
            people: people as u32,
            media: media as u32,
            files: files as u32,
            alternate_files: alternate_files as u32,
        })
    }

    pub async fn list_storage(&self) -> Result<Vec<Storage>> {
        let mut conn = self.pool.get().await?;

        let stores = storage::table.load::<Storage>(&mut conn).await?;
        Ok(stores)
    }

    pub async fn list_online_alternate_files(
        &self,
        storage: &Storage,
    ) -> Result<Vec<(AlternateFile, MediaFilePath, RemotePath)>> {
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
            .load::<(AlternateFile, String, String)>(&mut conn)
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
        storage: &Storage,
    ) -> Result<Vec<(MediaFile, MediaFilePath, RemotePath)>> {
        let mut conn = self.pool.get().await?;

        let files = media_file::table
            .inner_join(media_item::table.on(media_file::media.eq(media_item::id)))
            .inner_join(catalog::table.on(media_item::catalog.eq(catalog::id)))
            .filter(catalog::storage.eq(&storage.id))
            .select((media_file::all_columns, media_item::catalog))
            .load::<(MediaFile, String)>(&mut conn)
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
        while readers.len() > 0 {
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
    ) -> Result<Vec<(AlternateFile, MediaFilePath, PathBuf)>> {
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
            .load::<(AlternateFile, String, String)>(&mut conn)
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
