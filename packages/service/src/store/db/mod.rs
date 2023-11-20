pub(crate) mod functions;
#[allow(unreachable_pub)]
pub(super) mod schema;
pub(crate) mod search;

use std::{path::PathBuf, pin::Pin};

use chrono::{Duration, Utc};
use diesel::{
    dsl::{count, now},
    migration::{Migration, MigrationSource},
    pg::Pg,
    prelude::*,
    query_builder::{AsQuery, QueryFragment, QueryId},
};
use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    scoped_futures::ScopedFutureExt,
    AsyncConnection, AsyncPgConnection, RunQueryDsl, SimpleAsyncConnection, TransactionManager,
};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use futures::Future;
use schema::*;
use tracing::{info, instrument, trace};

use self::functions::{media_view, media_view_columns};
use super::{models, path::FilePath, Result};
use crate::{shared::long_id, store::metadata::reprocess_all_media, Config, Error};

pub(crate) type BackendConnection = AsyncPgConnection;
pub(crate) type DbPool = Pool<BackendConnection>;

const TOKEN_EXPIRY_DAYS: i64 = 90;

const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

#[instrument(err, skip_all)]
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
    let pool_config = AsyncDieselConnectionManager::<BackendConnection>::new(&config.database_url);
    let pool = Pool::builder(pool_config).build()?;

    // Verify that we can connect and update cached views.
    let mut connection = pool.get().await?;
    connection
        .batch_execute("REFRESH MATERIALIZED VIEW \"user_catalog\";")
        .await?;
    connection
        .batch_execute("REFRESH MATERIALIZED VIEW \"album_descendent\";")
        .await?;
    connection
        .batch_execute("REFRESH MATERIALIZED VIEW \"tag_descendent\";")
        .await?;
    connection
        .batch_execute("REFRESH MATERIALIZED VIEW \"tag_relation\";")
        .await?;
    connection
        .batch_execute("REFRESH MATERIALIZED VIEW \"album_relation\";")
        .await?;
    connection
        .batch_execute("REFRESH MATERIALIZED VIEW \"person_relation\";")
        .await?;

    // Clear expired auth tokens.
    diesel::delete(auth_token::table.filter(auth_token::expiry.le(now)))
        .execute(&mut connection)
        .await?;

    if reprocess_media {
        connection
            .transaction::<(), Error, _>(|conn| {
                async move {
                    let mut tx = DbConnection {
                        conn,
                        config: config.clone(),
                        is_transaction: true,
                    };

                    reprocess_all_media(&mut tx).await?;

                    let catalogs = tx.list_catalogs().await?;

                    for catalog in catalogs {
                        tx.update_searches(&catalog.id).await?;
                    }

                    Ok(())
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
    conn: &'a mut BackendConnection,
    config: Config,
    is_transaction: bool,
}

impl<'a> SimpleAsyncConnection for DbConnection<'a> {
    fn batch_execute<'life0, 'life1, 'async_trait>(
        &'life0 mut self,
        query: &'life1 str,
    ) -> Pin<Box<dyn Future<Output = QueryResult<()>> + Send + 'async_trait>>
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        Self: 'async_trait,
    {
        self.conn.batch_execute(query)
    }
}

impl<'a> AsyncConnection for DbConnection<'a> {
    type ExecuteFuture<'conn, 'query> = <BackendConnection as AsyncConnection>::ExecuteFuture<'conn, 'query>
    where
        Self: 'conn;

    type LoadFuture<'conn, 'query> = <BackendConnection as AsyncConnection>::LoadFuture<'conn, 'query>
    where
        Self: 'conn;

    type Stream<'conn, 'query> = <BackendConnection as AsyncConnection>::Stream<'conn, 'query>
    where
        Self: 'conn;

    type Row<'conn, 'query> = <BackendConnection as AsyncConnection>::Row<'conn, 'query>
    where
        Self: 'conn;

    type Backend = <BackendConnection as AsyncConnection>::Backend;
    type TransactionManager = <BackendConnection as AsyncConnection>::TransactionManager;

    fn establish<'life0, 'async_trait>(
        _database_url: &'life0 str,
    ) -> Pin<Box<dyn Future<Output = ConnectionResult<Self>> + Send + 'async_trait>>
    where
        'life0: 'async_trait,
        Self: 'async_trait,
    {
        todo!();
    }

    fn load<'conn, 'query, T>(&'conn mut self, source: T) -> Self::LoadFuture<'conn, 'query>
    where
        T: AsQuery + 'query,
        T::Query: QueryFragment<Self::Backend> + QueryId + 'query,
    {
        AsyncConnection::load(&mut self.conn, source)
    }

    fn execute_returning_count<'conn, 'query, T>(
        &'conn mut self,
        source: T,
    ) -> Self::ExecuteFuture<'conn, 'query>
    where
        T: QueryFragment<Self::Backend> + QueryId + 'query,
    {
        AsyncConnection::execute_returning_count(self.conn, source)
    }

    fn transaction_state(
        &mut self,
    ) -> &mut <Self::TransactionManager as TransactionManager<Self>>::TransactionStateData {
        AsyncConnection::transaction_state(self.conn)
    }
}

impl<'a> DbConnection<'a> {
    pub(crate) fn from_transaction(conn: &'a mut BackendConnection, config: &Config) -> Self {
        Self {
            conn,
            config: config.clone(),
            is_transaction: true,
        }
    }

    pub(crate) fn from_connection(conn: &'a mut BackendConnection, config: &Config) -> Self {
        Self {
            conn,
            config: config.clone(),
            is_transaction: false,
        }
    }

    pub fn assert_in_transaction(&self) {
        assert!(self.is_transaction);
    }

    pub fn config(&self) -> &Config {
        &self.config
    }

    pub async fn list_media_files(
        &mut self,
        catalog: &str,
    ) -> Result<Vec<(models::MediaFile, FilePath)>> {
        let files = media_file::table
            .inner_join(media_item::table.on(media_file::media_item.eq(media_item::id)))
            .filter(media_item::catalog.eq(&catalog))
            .select(media_file::all_columns)
            .load::<models::MediaFile>(self)
            .await?;

        Ok(files
            .into_iter()
            .map(|media_file| {
                let file_path = FilePath {
                    catalog: catalog.to_owned(),
                    item: media_file.media_item.clone(),
                    file: media_file.id.clone(),
                    file_name: media_file.file_name.clone(),
                };
                (media_file, file_path)
            })
            .collect())
    }

    pub async fn list_alternate_files(
        &mut self,
        catalog: &str,
    ) -> Result<Vec<(models::AlternateFile, FilePath)>> {
        let files = alternate_file::table
            .inner_join(media_file::table.on(media_file::id.eq(alternate_file::media_file)))
            .inner_join(media_item::table.on(media_file::media_item.eq(media_item::id)))
            .filter(media_item::catalog.eq(&catalog))
            .select((alternate_file::all_columns, media_item::id))
            .load::<(models::AlternateFile, String)>(self)
            .await?;

        Ok(files
            .into_iter()
            .map(|(alternate, media_item)| {
                let file_path = FilePath {
                    catalog: catalog.to_owned(),
                    item: media_item,
                    file: alternate.media_file.clone(),
                    file_name: alternate.file_name.clone(),
                };
                (alternate, file_path)
            })
            .collect())
    }

    pub async fn list_online_alternate_files(
        &mut self,
        storage: &models::Storage,
    ) -> Result<Vec<(models::AlternateFile, FilePath)>> {
        let files = alternate_file::table
            .inner_join(media_file::table.on(media_file::id.eq(alternate_file::media_file)))
            .inner_join(media_item::table.on(media_file::media_item.eq(media_item::id)))
            .inner_join(catalog::table.on(media_item::catalog.eq(catalog::id)))
            .filter(alternate_file::local.eq(false))
            .filter(catalog::storage.eq(&storage.id))
            .select((
                alternate_file::all_columns,
                media_item::id,
                media_item::catalog,
            ))
            .load::<(models::AlternateFile, String, String)>(self)
            .await?;

        Ok(files
            .into_iter()
            .map(|(alternate, media_item, catalog)| {
                let file_path = FilePath {
                    catalog,
                    item: media_item,
                    file: alternate.media_file.clone(),
                    file_name: alternate.file_name.clone(),
                };
                (alternate, file_path)
            })
            .collect())
    }

    pub async fn list_online_media_files(
        &mut self,
        storage: &models::Storage,
    ) -> Result<Vec<(models::MediaFile, FilePath)>> {
        let files = media_file::table
            .inner_join(media_item::table.on(media_file::media_item.eq(media_item::id)))
            .inner_join(catalog::table.on(media_item::catalog.eq(catalog::id)))
            .filter(catalog::storage.eq(&storage.id))
            .select((media_file::all_columns, media_item::catalog))
            .load::<(models::MediaFile, String)>(self)
            .await?;

        Ok(files
            .into_iter()
            .map(|(media_file, catalog)| {
                let file_path = FilePath {
                    catalog,
                    item: media_file.media_item.clone(),
                    file: media_file.id.clone(),
                    file_name: media_file.file_name.clone(),
                };
                (media_file, file_path)
            })
            .collect())
    }

    pub async fn verify_credentials(
        &mut self,
        email: &str,
        password: &str,
    ) -> Result<(models::User, String)> {
        let mut user: models::User = user::table
            .filter(user::email.eq(email))
            .select(user::all_columns)
            .get_result::<models::User>(self)
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

        let token = long_id("T");
        let auth_token = models::AuthToken {
            email: email.to_owned(),
            token: token.clone(),
            expiry: Some(Utc::now() + Duration::days(TOKEN_EXPIRY_DAYS)),
        };

        diesel::insert_into(auth_token::table)
            .values(&auth_token)
            .execute(self)
            .await?;

        user.last_login = Some(Utc::now());

        diesel::update(user::table)
            .filter(user::email.eq(email))
            .set(user::last_login.eq(&user.last_login))
            .execute(self)
            .await?;

        Ok((user, token))
    }

    pub async fn verify_token(&mut self, token: &str) -> Result<models::User> {
        let mut user: models::User = auth_token::table
            .inner_join(user::table.on(user::email.eq(auth_token::email)))
            .filter(auth_token::token.eq(token))
            .filter(auth_token::expiry.is_null().or(auth_token::expiry.gt(now)))
            .select(user::all_columns)
            .get_result::<models::User>(self)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)?;

        user.last_login = Some(Utc::now());

        diesel::update(user::table)
            .filter(user::email.eq(&user.email))
            .set(user::last_login.eq(&user.last_login))
            .execute(self)
            .await?;

        let expiry = Utc::now() + Duration::days(TOKEN_EXPIRY_DAYS);
        diesel::update(auth_token::table)
            .filter(auth_token::email.eq(&user.email))
            .set(auth_token::expiry.eq(expiry))
            .execute(self)
            .await?;

        Ok(user)
    }

    pub async fn delete_token(&mut self, token: &str) -> Result {
        diesel::delete(auth_token::table.filter(auth_token::token.eq(token)))
            .execute(self)
            .await?;

        Ok(())
    }

    pub async fn stats(&mut self) -> Result<StoreStats> {
        let users: i64 = user::table.count().get_result(self).await?;
        let catalogs: i64 = catalog::table.count().get_result(self).await?;
        let albums: i64 = album::table.count().get_result(self).await?;
        let tags: i64 = tag::table.count().get_result(self).await?;
        let people: i64 = person::table.count().get_result(self).await?;
        let media: i64 = media_item::table.count().get_result(self).await?;
        let files: i64 = media_file::table.count().get_result(self).await?;
        let alternate_files: i64 = alternate_file::table.count().get_result(self).await?;

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
            .get_result::<models::User>(self)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }

    pub async fn get_catalog_storage(&mut self, catalog: &str) -> Result<models::Storage> {
        storage::table
            .inner_join(catalog::table.on(catalog::storage.eq(storage::id)))
            .filter(catalog::id.eq(catalog))
            .select(storage::all_columns)
            .get_result::<models::Storage>(self)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }

    pub async fn list_storage(&mut self) -> Result<Vec<models::Storage>> {
        Ok(storage::table
            .select(storage::all_columns)
            .load::<models::Storage>(self)
            .await?)
    }

    pub async fn list_catalogs(&mut self) -> Result<Vec<models::Catalog>> {
        Ok(catalog::table
            .select(catalog::all_columns)
            .load::<models::Catalog>(self)
            .await?)
    }

    pub async fn list_user_storage(&mut self, email: &str) -> Result<Vec<models::Storage>> {
        Ok(storage::table
            .filter(storage::owner.eq(email))
            .select(storage::all_columns)
            .load::<models::Storage>(self)
            .await?)
    }

    pub async fn list_user_catalogs(&mut self, email: &str) -> Result<Vec<models::Catalog>> {
        Ok(catalog::table
            .inner_join(user_catalog::table.on(user_catalog::catalog.eq(catalog::id)))
            .filter(user_catalog::user.eq(email))
            .select(catalog::all_columns)
            .order(catalog::name.asc())
            .load::<models::Catalog>(self)
            .await?)
    }

    pub async fn list_user_people(&mut self, email: &str) -> Result<Vec<models::Person>> {
        Ok(user_catalog::table
            .inner_join(person::table.on(person::catalog.eq(user_catalog::catalog)))
            .filter(user_catalog::user.eq(email))
            .select(person::all_columns)
            .order(person::name.asc())
            .load::<models::Person>(self)
            .await?)
    }

    pub async fn list_user_tags(&mut self, email: &str) -> Result<Vec<models::Tag>> {
        Ok(user_catalog::table
            .inner_join(tag::table.on(tag::catalog.eq(user_catalog::catalog)))
            .filter(user_catalog::user.eq(email))
            .select(tag::all_columns)
            .order(tag::name.asc())
            .load::<models::Tag>(self)
            .await?)
    }

    pub async fn list_user_albums(&mut self, email: &str) -> Result<Vec<models::Album>> {
        Ok(user_catalog::table
            .inner_join(album::table.on(album::catalog.eq(user_catalog::catalog)))
            .filter(user_catalog::user.eq(email))
            .select(album::all_columns)
            .order(album::name.asc())
            .load::<models::Album>(self)
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
            .load::<(models::Album, i64)>(self)
            .await?)
    }

    pub async fn get_user_album(
        &mut self,
        email: &str,
        album: &str,
        recursive: bool,
    ) -> Result<(models::Album, i64)> {
        if recursive {
            user_catalog::table
                .inner_join(album::table.on(album::catalog.eq(user_catalog::catalog)))
                .inner_join(album_descendent::table.on(album::id.eq(album_descendent::id)))
                .inner_join(
                    media_album::table.on(album_descendent::descendent.eq(media_album::album)),
                )
                .filter(user_catalog::user.eq(email))
                .filter(album::id.eq(album))
                .group_by(album::id)
                .select((album::all_columns, count(media_album::media)))
                .get_result::<(models::Album, i64)>(self)
                .await
                .optional()?
                .ok_or_else(|| Error::NotFound)
        } else {
            user_catalog::table
                .inner_join(album::table.on(album::catalog.eq(user_catalog::catalog)))
                .inner_join(media_album::table.on(album::id.eq(media_album::album)))
                .filter(user_catalog::user.eq(email))
                .filter(album::id.eq(album))
                .group_by(album::id)
                .select((album::all_columns, count(media_album::media)))
                .get_result::<(models::Album, i64)>(self)
                .await
                .optional()?
                .ok_or_else(|| Error::NotFound)
        }
    }

    pub async fn list_album_media(
        &mut self,
        album: &models::Album,
        recursive: bool,
        offset: Option<i64>,
        count: Option<i64>,
    ) -> Result<Vec<models::MediaView>> {
        album.list_media(self, recursive, offset, count).await
    }

    pub async fn get_user_search(
        &mut self,
        email: &str,
        search: &str,
    ) -> Result<(models::SavedSearch, i64)> {
        user_catalog::table
            .inner_join(saved_search::table.on(saved_search::catalog.eq(user_catalog::catalog)))
            .inner_join(media_search::table.on(saved_search::id.eq(media_search::search)))
            .filter(user_catalog::user.eq(email))
            .filter(saved_search::id.eq(search))
            .group_by(saved_search::id)
            .select((saved_search::all_columns, count(media_search::media)))
            .get_result::<(models::SavedSearch, i64)>(self)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }

    pub async fn list_search_media(
        &mut self,
        search: &models::SavedSearch,
        offset: Option<i64>,
        count: Option<i64>,
    ) -> Result<Vec<models::MediaView>> {
        search.list_media(self, offset, count).await
    }

    pub async fn get_user_catalog(
        &mut self,
        email: &str,
        catalog: &str,
    ) -> Result<(models::Catalog, i64)> {
        user_catalog::table
            .inner_join(catalog::table.on(catalog::id.eq(user_catalog::catalog)))
            .inner_join(media_item::table.on(catalog::id.eq(media_item::catalog)))
            .filter(user_catalog::user.eq(email))
            .filter(catalog::id.eq(catalog))
            .group_by(catalog::id)
            .select((catalog::all_columns, count(media_item::id)))
            .get_result::<(models::Catalog, i64)>(self)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }

    pub async fn get_user_media(
        &mut self,
        email: &str,
        media: &[&str],
    ) -> Result<Vec<models::MediaRelations>> {
        let media = media_view!()
            .inner_join(user_catalog::table.on(user_catalog::catalog.eq(media_item::catalog)))
            .left_join(album_relation::table.on(album_relation::media.eq(media_item::id)))
            .left_join(tag_relation::table.on(tag_relation::media.eq(media_item::id)))
            .left_join(person_relation::table.on(person_relation::media.eq(media_item::id)))
            .filter(user_catalog::user.eq(email))
            .filter(media_item::id.eq_any(media))
            .select((
                media_view_columns!(),
                album_relation::albums.nullable(),
                tag_relation::tags.nullable(),
                person_relation::people.nullable(),
            ))
            .load::<models::MediaRelations>(self)
            .await?;

        Ok(media)
    }

    pub async fn get_user_media_file(
        &mut self,
        email: &str,
        media: &str,
        file: &str,
    ) -> Result<(models::MediaFile, FilePath)> {
        let (media_file, catalog) = media_file::table
            .inner_join(media_item::table.on(media_item::id.eq(media_file::media_item)))
            .inner_join(user_catalog::table.on(user_catalog::catalog.eq(media_item::catalog)))
            .filter(user_catalog::user.eq(email))
            .filter(media_item::id.eq(media))
            .filter(media_file::id.eq(file))
            .select((media_file::all_columns, media_item::catalog))
            .get_result::<(models::MediaFile, String)>(self)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)?;

        let file_path = FilePath {
            catalog,
            item: media.to_owned(),
            file: file.to_owned(),
            file_name: media_file.file_name.clone(),
        };
        Ok((media_file, file_path))
    }

    pub async fn list_catalog_media(
        &mut self,
        catalog: &models::Catalog,
        offset: Option<i64>,
        count: Option<i64>,
    ) -> Result<Vec<models::MediaView>> {
        catalog.list_media(self, offset, count).await
    }

    pub async fn list_media_alternates(
        &mut self,
        email: Option<&str>,
        item: &str,
        file: &str,
        mimetype: &str,
        alternate_type: models::AlternateFileType,
    ) -> Result<Vec<(models::AlternateFile, FilePath, PathBuf)>> {
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
                .load::<(models::AlternateFile, String, String)>(self)
                .await?;

            if !files.is_empty() {
                return Ok(files
                    .into_iter()
                    .map(|(alternate, media_item, catalog)| {
                        let file_path = FilePath {
                            catalog,
                            item: media_item,
                            file: alternate.media_file.clone(),
                            file_name: alternate.file_name.clone(),
                        };
                        let local_path = self.config.local_path(&file_path);
                        (alternate, file_path, local_path)
                    })
                    .collect::<Vec<(models::AlternateFile, FilePath, PathBuf)>>());
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
            .load::<models::SavedSearch>(self)
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
            .load::<(models::SavedSearch, i64)>(self)
            .await?)
    }

    pub async fn update_searches(&mut self, catalog: &str) -> Result {
        let searches = saved_search::table
            .filter(saved_search::catalog.eq(catalog))
            .select(saved_search::all_columns)
            .load::<models::SavedSearch>(self)
            .await?;

        for search in searches {
            search.update(self).await?;
        }

        Ok(())
    }
}
