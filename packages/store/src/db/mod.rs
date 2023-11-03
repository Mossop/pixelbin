pub(crate) mod functions;
pub(crate) mod search;

use std::path::PathBuf;

use diesel::{
    dsl::count,
    migration::{Migration, MigrationSource},
    pg::Pg,
    prelude::*,
};
use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    scoped_futures::ScopedFutureExt,
    AsyncConnection, AsyncPgConnection, RunQueryDsl, SimpleAsyncConnection,
};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use time::OffsetDateTime;
use tracing::{error, info, instrument, trace};

use crate::{
    joinable,
    metadata::{process_media, PROCESS_VERSION},
    models::{self, MediaFile},
    schema::*,
    MediaFilePath, RemotePath, Result,
};
use pixelbin_shared::{Config, Error};

pub(crate) type BackendConnection = AsyncPgConnection;
pub(crate) type DbPool = Pool<BackendConnection>;

const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

#[instrument(skip_all)]
async fn reprocess_all_media(tx: &mut DbConnection<'_>) -> Result<()> {
    info!("Reprocessing media metadata");
    let list = MediaFile::list_current(tx).await?;

    let mut media_files = Vec::new();

    for (media_file, file_path) in list {
        let media_file = if media_file.process_version != PROCESS_VERSION {
            match process_media(tx.config(), &file_path).await {
                Ok(media_file) => media_file,
                Err(e) => {
                    error!(media = media_file.media, error = ?e, "Failed to process media metadata");
                    continue;
                }
            }
        } else {
            media_file
        };

        media_files.push(media_file);
    }

    MediaFile::upsert(tx, &media_files).await?;

    Ok(())
}

#[instrument(err)]
pub(crate) async fn connect(config: &Config) -> Result<DbPool> {
    #![allow(clippy::borrowed_box)]
    let mut reprocess_media = false;

    // First connect synchronously to apply migrations.
    let mut connection = PgConnection::establish(&config.database_url)?;
    let migrations =
        connection
            .pending_migrations(MIGRATIONS)
            .map_err(|e| Error::DbMigrationError {
                message: e.to_string(),
            })?;
    for migration in migrations.iter() {
        let name = migration.name().to_string();

        info!(migration = name, "Running migration");
        connection
            .run_migration(migration)
            .map_err(|e| Error::DbMigrationError {
                message: e.to_string(),
            })?;

        if name.as_str() == "2023-11-03-094027_date_cache" {
            // Force a reprocess to re-generate the date fields.
            reprocess_media = true;
        }
    }

    // Now set up the async pool.
    let pool_config = AsyncDieselConnectionManager::<AsyncPgConnection>::new(&config.database_url);
    let pool = Pool::builder(pool_config).build()?;

    // Verify that we can connect.
    let mut connection = pool.get().await?;
    connection
        .batch_execute("REFRESH MATERIALIZED VIEW \"user_catalog\";")
        .await?;

    if reprocess_media {
        connection
            .transaction(|conn| {
                async move {
                    let mut tx = DbConnection {
                        conn,
                        config: config.clone(),
                        is_transaction: true,
                    };

                    reprocess_all_media(&mut tx).await
                }
                .scope_boxed()
            })
            .await?;
    }

    let last_migration = if migrations.is_empty() {
        MIGRATIONS
            .migrations()
            .map_err(|e| Error::DbMigrationError {
                message: e.to_string(),
            })?
            .last()
            .map(|m: &Box<dyn Migration<Pg>>| m.name().to_string())
    } else {
        migrations.last().map(|m| m.name().to_string())
    };

    trace!(migration = last_migration, "Database is fully migrated");

    Ok(pool)
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

pub struct DbConnection<'a> {
    pub(crate) conn: &'a mut BackendConnection,
    pub(crate) config: Config,
    pub(super) is_transaction: bool,
}

impl<'a> DbConnection<'a> {
    pub fn assert_in_transaction(&self) {
        assert!(self.is_transaction);
    }

    pub fn config(&self) -> &Config {
        &self.config
    }

    pub async fn list_online_alternate_files(
        &mut self,
        storage: &models::Storage,
    ) -> Result<Vec<(models::AlternateFile, MediaFilePath, RemotePath)>> {
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
            .load::<(models::AlternateFile, String, String)>(self.conn)
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
        &mut self,
        storage: &models::Storage,
    ) -> Result<Vec<(models::MediaFile, MediaFilePath, RemotePath)>> {
        let files = media_file::table
            .inner_join(media_item::table.on(media_file::media.eq(media_item::id)))
            .inner_join(catalog::table.on(media_item::catalog.eq(catalog::id)))
            .filter(catalog::storage.eq(&storage.id))
            .select((media_file::all_columns, media_item::catalog))
            .load::<(models::MediaFile, String)>(self.conn)
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

    pub async fn verify_credentials(
        &mut self,
        email: &str,
        password: &str,
    ) -> Result<models::User> {
        let mut user: models::User = user::table
            .filter(user::email.eq(email))
            .select(user::all_columns)
            .get_result::<models::User>(self.conn)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)?;

        if let Some(ref password_hash) = user.password {
            match bcrypt::verify(password, password_hash) {
                Ok(true) => (),
                _ => return Err(Error::NotFound),
            }
        } else {
            return Err(Error::NotFound);
        }

        user.last_login = Some(OffsetDateTime::now_utc());

        diesel::update(user::table)
            .filter(user::email.eq(email))
            .set(user::last_login.eq(&user.last_login))
            .execute(self.conn)
            .await?;

        Ok(user)
    }

    pub async fn stats(&mut self) -> Result<StoreStats> {
        let users: i64 = user::table.count().get_result(self.conn).await?;
        let catalogs: i64 = catalog::table.count().get_result(self.conn).await?;
        let albums: i64 = album::table.count().get_result(self.conn).await?;
        let tags: i64 = tag::table.count().get_result(self.conn).await?;
        let people: i64 = person::table.count().get_result(self.conn).await?;
        let media: i64 = media_item::table.count().get_result(self.conn).await?;
        let files: i64 = media_file::table.count().get_result(self.conn).await?;
        let alternate_files: i64 = alternate_file::table.count().get_result(self.conn).await?;

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

    pub async fn get_user(&mut self, email: &str) -> Result<models::User> {
        user::table
            .filter(user::email.eq(email))
            .select(user::all_columns)
            .get_result::<models::User>(self.conn)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }

    pub async fn get_catalog_storage(&mut self, catalog: &str) -> Result<models::Storage> {
        storage::table
            .inner_join(catalog::table.on(catalog::storage.eq(storage::id)))
            .filter(catalog::id.eq(catalog))
            .select(storage::all_columns)
            .get_result::<models::Storage>(self.conn)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }

    pub async fn list_storage(&mut self) -> Result<Vec<models::Storage>> {
        Ok(storage::table
            .select(storage::all_columns)
            .load::<models::Storage>(self.conn)
            .await?)
    }

    pub async fn list_catalogs(&mut self) -> Result<Vec<models::Catalog>> {
        Ok(catalog::table
            .select(catalog::all_columns)
            .load::<models::Catalog>(self.conn)
            .await?)
    }

    pub async fn list_user_storage(&mut self, email: &str) -> Result<Vec<models::Storage>> {
        Ok(storage::table
            .filter(storage::owner.eq(email))
            .select(storage::all_columns)
            .load::<models::Storage>(self.conn)
            .await?)
    }

    pub async fn list_user_catalogs(&mut self, email: &str) -> Result<Vec<models::Catalog>> {
        Ok(catalog::table
            .inner_join(user_catalog::table.on(user_catalog::catalog.eq(catalog::id)))
            .filter(user_catalog::user.eq(email))
            .select(catalog::all_columns)
            .order(catalog::name.asc())
            .load::<models::Catalog>(self.conn)
            .await?)
    }

    pub async fn list_user_people(&mut self, email: &str) -> Result<Vec<models::Person>> {
        Ok(user_catalog::table
            .inner_join(person::table.on(person::catalog.eq(user_catalog::catalog)))
            .filter(user_catalog::user.eq(email))
            .select(person::all_columns)
            .order(person::name.asc())
            .load::<models::Person>(self.conn)
            .await?)
    }

    pub async fn list_user_tags(&mut self, email: &str) -> Result<Vec<models::Tag>> {
        Ok(user_catalog::table
            .inner_join(tag::table.on(tag::catalog.eq(user_catalog::catalog)))
            .filter(user_catalog::user.eq(email))
            .select(tag::all_columns)
            .order(tag::name.asc())
            .load::<models::Tag>(self.conn)
            .await?)
    }

    pub async fn list_user_albums(&mut self, email: &str) -> Result<Vec<models::Album>> {
        Ok(user_catalog::table
            .inner_join(album::table.on(album::catalog.eq(user_catalog::catalog)))
            .filter(user_catalog::user.eq(email))
            .select(album::all_columns)
            .order(album::name.asc())
            .load::<models::Album>(self.conn)
            .await?)
    }

    pub async fn list_user_albums_with_count(
        &mut self,
        email: &str,
    ) -> Result<Vec<(models::Album, i64)>> {
        Ok(user_catalog::table
            .inner_join(album::table.on(album::catalog.eq(user_catalog::catalog)))
            .left_join(media_album::table.on(media_album::album.eq(album::id)))
            .filter(user_catalog::user.eq(email))
            .group_by(album::id)
            .select((album::all_columns, count(media_album::media.nullable())))
            .order(album::name.asc())
            .load::<(models::Album, i64)>(self.conn)
            .await?)
    }

    pub async fn get_user_album(&mut self, email: &str, album: &str) -> Result<models::Album> {
        user_catalog::table
            .inner_join(album::table.on(album::catalog.eq(user_catalog::catalog)))
            .filter(user_catalog::user.eq(email))
            .filter(album::id.eq(album))
            .select(album::all_columns)
            .get_result::<models::Album>(self.conn)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }

    pub async fn list_album_media(
        &mut self,
        album: &models::Album,
        _recursive: bool,
    ) -> Result<Vec<models::MediaView>> {
        album.list_media(self.conn).await
    }

    pub async fn get_user_search(
        &mut self,
        email: &str,
        search: &str,
    ) -> Result<models::SavedSearch> {
        user_catalog::table
            .inner_join(saved_search::table.on(saved_search::catalog.eq(user_catalog::catalog)))
            .filter(user_catalog::user.eq(email))
            .filter(saved_search::id.eq(search))
            .select(saved_search::all_columns)
            .get_result::<models::SavedSearch>(self.conn)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }

    pub async fn list_search_media(
        &mut self,
        search: &models::SavedSearch,
    ) -> Result<Vec<models::MediaView>> {
        search.list_media(self.conn).await
    }

    pub async fn get_user_catalog(
        &mut self,
        email: &str,
        catalog: &str,
    ) -> Result<models::Catalog> {
        user_catalog::table
            .inner_join(catalog::table.on(catalog::id.eq(user_catalog::catalog)))
            .filter(user_catalog::user.eq(email))
            .filter(catalog::id.eq(catalog))
            .select(catalog::all_columns)
            .get_result::<models::Catalog>(self.conn)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }

    pub async fn list_catalog_media(
        &mut self,
        catalog: &models::Catalog,
    ) -> Result<Vec<models::MediaView>> {
        catalog.list_media(self.conn).await
    }

    pub async fn list_media_alternates(
        &mut self,
        email: Option<&str>,
        item: &str,
        file: &str,
        mimetype: &str,
        alternate_type: models::AlternateFileType,
    ) -> Result<Vec<(models::AlternateFile, MediaFilePath, PathBuf)>> {
        if let Some(email) = email {
            let files = user_catalog::table
                .filter(user_catalog::user.eq(email))
                .inner_join(media_item::table.on(media_item::catalog.eq(user_catalog::catalog)))
                .filter(media_item::id.eq(item))
                .filter(media_item::media_file.eq(file))
                .inner_join(
                    alternate_file::table
                        .on(media_item::media_file.eq(alternate_file::media_file.nullable())),
                )
                .filter(alternate_file::mimetype.eq(mimetype))
                .filter(alternate_file::type_.eq(alternate_type))
                .select((
                    alternate_file::all_columns,
                    media_item::id,
                    media_item::catalog,
                ))
                .load::<(models::AlternateFile, String, String)>(self.conn)
                .await?;

            if !files.is_empty() {
                return Ok(files
                    .into_iter()
                    .map(|(alternate, media_item, catalog)| {
                        let file_path =
                            MediaFilePath::new(&catalog, &media_item, &alternate.media_file);
                        let local_path = self
                            .config
                            .local_storage
                            .join(file_path.local_path())
                            .join(joinable(&alternate.file_name));
                        (alternate, file_path, local_path)
                    })
                    .collect::<Vec<(models::AlternateFile, MediaFilePath, PathBuf)>>());
            }
        }

        Ok(vec![])
    }

    pub async fn list_user_searches(&mut self, email: &str) -> Result<Vec<models::SavedSearch>> {
        Ok(user_catalog::table
            .inner_join(saved_search::table.on(saved_search::catalog.eq(user_catalog::catalog)))
            .filter(user_catalog::user.eq(email))
            .select(saved_search::all_columns)
            .order(saved_search::name.asc())
            .load::<models::SavedSearch>(self.conn)
            .await?)
    }

    pub async fn list_user_searches_with_count(
        &mut self,
        email: &str,
    ) -> Result<Vec<(models::SavedSearch, i64)>> {
        Ok(user_catalog::table
            .inner_join(saved_search::table.on(saved_search::catalog.eq(user_catalog::catalog)))
            .left_join(media_search::table.on(media_search::search.eq(saved_search::id)))
            .filter(user_catalog::user.eq(email))
            .group_by(saved_search::id)
            .select((
                saved_search::all_columns,
                count(media_search::media.nullable()),
            ))
            .order(saved_search::name.asc())
            .load::<(models::SavedSearch, i64)>(self.conn)
            .await?)
    }

    pub async fn update_searches(&mut self, catalog: &str) -> Result {
        let searches = saved_search::table
            .filter(saved_search::catalog.eq(catalog))
            .select(saved_search::all_columns)
            .load::<models::SavedSearch>(self.conn)
            .await?;

        for search in searches {
            search.update(self.conn).await?;
        }

        Ok(())
    }
}
