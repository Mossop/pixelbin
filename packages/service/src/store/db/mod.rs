pub(crate) mod functions;
pub(crate) mod models;
#[allow(unreachable_pub)]
pub(super) mod schema;
pub(crate) mod search;

use std::pin::Pin;

use chrono::{Duration, Utc};
use diesel::{
    dsl::now,
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

use crate::{metadata::reprocess_catalog_media, shared::long_id, Config, Error, Result};

pub(crate) type BackendConnection = AsyncPgConnection;
pub(crate) type DbPool = Pool<BackendConnection>;

const TOKEN_EXPIRY_DAYS: i64 = 90;

const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

#[instrument(err, skip_all)]
pub(crate) async fn connect(config: &Config) -> Result<DbPool> {
    #![allow(clippy::borrowed_box)]
    let mut reprocess_media = false;
    let mut update_search_queries = false;

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

        if name.as_str() == "2024-02-19-120807_alternates_lookup" {
            update_search_queries = true;
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
        .batch_execute("REFRESH MATERIALIZED VIEW \"album_relation\";")
        .await?;
    connection
        .batch_execute("REFRESH MATERIALIZED VIEW \"tag_descendent\";")
        .await?;
    connection
        .batch_execute("REFRESH MATERIALIZED VIEW \"tag_relation\";")
        .await?;
    connection
        .batch_execute("REFRESH MATERIALIZED VIEW \"person_relation\";")
        .await?;
    connection
        .batch_execute("REFRESH MATERIALIZED VIEW \"media_file_alternates\";")
        .await?;

    // Clear expired auth tokens.
    diesel::delete(auth_token::table.filter(auth_token::expiry.le(now)))
        .execute(&mut connection)
        .await?;

    if reprocess_media {
        connection
            .transaction::<(), Error, _>(|conn| {
                async move {
                    let mut tx = DbConnection::from_transaction(conn, config);
                    let catalogs = models::Catalog::list(&mut tx).await?;

                    for catalog in catalogs {
                        reprocess_catalog_media(&mut tx, &catalog.id, false).await?;
                    }

                    Ok(())
                }
                .scope_boxed()
            })
            .await?;
    }

    if update_search_queries {
        connection
            .transaction::<(), Error, _>(|conn| {
                async move {
                    let mut tx = DbConnection::from_transaction(conn, config);
                    models::SavedSearch::upgrade_queries(&mut tx).await?;

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

    pub(crate) async fn verify_credentials(
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

    pub(crate) async fn verify_token(&mut self, token: &str) -> Result<Option<models::User>> {
        let mut user: models::User = match auth_token::table
            .inner_join(user::table.on(user::email.eq(auth_token::email)))
            .filter(auth_token::token.eq(token))
            .filter(auth_token::expiry.is_null().or(auth_token::expiry.gt(now)))
            .select(user::all_columns)
            .get_result::<models::User>(self)
            .await
            .optional()?
        {
            Some(u) => u,
            None => return Ok(None),
        };

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

        Ok(Some(user))
    }

    pub(crate) async fn delete_token(&mut self, token: &str) -> Result {
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
}
