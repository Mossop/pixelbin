pub(crate) mod functions;
pub(crate) mod models;
#[allow(unreachable_pub)]
pub(super) mod schema;
pub(crate) mod search;
pub(super) mod views;

use std::pin::Pin;

use chrono::{Duration, Utc};
use diesel::{
    dsl::now,
    migration::{Migration, MigrationSource},
    pg::Pg,
    prelude::*,
    query_builder::{AsQuery, QueryFragment, QueryId},
    sql_query,
};
use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    scoped_futures::ScopedFutureExt,
    AsyncConnection, AsyncPgConnection, RunQueryDsl, SimpleAsyncConnection, TransactionManager,
};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use futures::Future;
use schema::*;
use scoped_futures::ScopedBoxFuture;
use tracing::{info, instrument, span, span::Id, trace, Level};

use crate::{
    metadata::{parse_metadata, METADATA_FILE},
    shared::{file_exists, long_id, spawn_blocking},
    store::{db::functions::media_file_columns, path::MediaFilePath, Isolation},
    Config, Error, Result, Task, TaskQueue,
};

pub(crate) type Backend = Pg;
pub(crate) type BackendConnection = AsyncPgConnection;
pub(crate) type DbPool = Pool<BackendConnection>;

const TOKEN_EXPIRY_DAYS: i64 = 90;

const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

#[instrument(err, skip_all)]
async fn reprocess_all_media(conn: &mut DbConnection<'_>) -> Result {
    let files = media_file::table
        .inner_join(media_item::table.on(media_item::id.eq(media_file::media_item)))
        .filter(media_item::deleted.eq(false))
        .select((media_file_columns!(), media_item::catalog))
        .for_update()
        .load::<(models::MediaFile, String)>(conn)
        .await?;

    let local_store = conn.config().local_store();
    let mut media_files = Vec::new();

    for (mut media_file, catalog) in files.into_iter() {
        let media_file_path = MediaFilePath {
            catalog,
            item: media_file.media_item.clone(),
            file: media_file.id.clone(),
        };

        let metadata_path = local_store.local_path(&media_file_path.file(METADATA_FILE));
        if file_exists(&metadata_path).await? {
            let metadata = parse_metadata(&metadata_path).await?;
            metadata.apply_to_media_file(&mut media_file);
        }

        media_files.push(media_file);
    }

    models::MediaFile::upsert(conn, media_files).await?;

    Ok(())
}

#[instrument(err, skip_all)]
async fn update_search_dates(conn: &mut DbConnection<'_>) -> Result {
    sql_query(
        r#"UPDATE "media_search" SET "added" = "media_file"."uploaded"
            FROM "media_item" JOIN "media_file" ON "media_item"."media_file"="media_file"."id"
            WHERE "media_item"."id" = "media_search"."media";"#,
    )
    .execute(conn)
    .await?;

    Ok(())
}

#[instrument(err, skip_all)]
pub(crate) async fn connect(config: &Config, task_span: Option<Id>) -> Result<(DbPool, TaskQueue)> {
    #![allow(clippy::borrowed_box)]
    let mut update_search_queries = false;
    let mut reprocess_media: bool = false;
    let mut update_search_date: bool = false;

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

        match name.as_str() {
            "2023-07-03-132731_search_cache" => update_search_date = true,
            "2024-04-05-120807_alternates_lookup" => {
                update_search_queries = true;
                reprocess_media = true;
            }
            _ => {}
        }
    }

    // Now set up the async pool.
    let pool_config = AsyncDieselConnectionManager::<BackendConnection>::new(&config.database_url);
    let pool = Pool::builder(pool_config).build()?;
    let task_queue = TaskQueue::new(pool.clone(), config.clone(), task_span);

    // Verify that we can connect and update cached views.
    let mut connection = pool.get().await?;
    let mut conn = DbConnection::new(&mut connection, config, &task_queue);

    conn.batch_execute("REFRESH MATERIALIZED VIEW \"user_catalog\";")
        .await?;
    conn.batch_execute("REFRESH MATERIALIZED VIEW \"album_descendent\";")
        .await?;
    conn.batch_execute("REFRESH MATERIALIZED VIEW \"album_relation\";")
        .await?;
    conn.batch_execute("REFRESH MATERIALIZED VIEW \"tag_descendent\";")
        .await?;
    conn.batch_execute("REFRESH MATERIALIZED VIEW \"tag_relation\";")
        .await?;
    conn.batch_execute("REFRESH MATERIALIZED VIEW \"person_relation\";")
        .await?;
    conn.batch_execute("REFRESH MATERIALIZED VIEW \"media_file_alternates\";")
        .await?;

    // Clear expired auth tokens.
    diesel::delete(auth_token::table.filter(auth_token::expiry.le(now)))
        .execute(&mut conn)
        .await?;

    if reprocess_media {
        conn.isolated(Isolation::Committed, |conn| {
            reprocess_all_media(conn).scope_boxed()
        })
        .await?;
    }

    if update_search_queries {
        conn.isolated(Isolation::Committed, |conn| {
            models::SavedSearch::upgrade_queries(conn).scope_boxed()
        })
        .await?;
    }

    if update_search_date {
        update_search_dates(&mut conn).await?;
    }

    let last_migration = if migrations.is_empty() {
        MIGRATIONS
            .migrations()
            .map_err(|e| Error::DbMigrationError {
                message: e.to_string(),
            })?
            .last()
            .map(|m: &Box<dyn Migration<Backend>>| m.name().to_string())
    } else {
        migrations.last().map(|m| m.name().to_string())
    };

    trace!(migration = last_migration, "Database is fully migrated");

    Ok((pool, task_queue))
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

pub struct DbConnection<'conn> {
    conn: &'conn mut BackendConnection,
    config: Config,
    isolation: Option<Isolation>,
    task_queue: TaskQueue,
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

impl<'conn> DbConnection<'conn> {
    pub(crate) fn new(
        conn: &'conn mut BackendConnection,
        config: &Config,
        task_queue: &TaskQueue,
    ) -> Self {
        Self {
            conn,
            config: config.clone(),
            isolation: None,
            task_queue: task_queue.clone(),
        }
    }

    pub async fn queue_task(&self, task: Task) {
        self.task_queue.queue_task(task).await;
    }

    pub async fn isolated<'a, R, F>(&'a mut self, level: Isolation, cb: F) -> Result<R>
    where
        R: 'a + Send,
        F: for<'b> FnOnce(&'b mut DbConnection<'b>) -> ScopedBoxFuture<'a, 'b, Result<R>>
            + Send
            + 'a,
    {
        let config = self.config.clone();
        let task_queue = self.task_queue.clone();

        if let Some(l) = self.isolation {
            assert_eq!(l, level);

            let mut db_conn = DbConnection {
                conn: self.conn,
                config,
                isolation: Some(level),
                task_queue,
            };
            return cb(&mut db_conn).await;
        }

        let mut builder = self.conn.build_transaction();
        builder = match level {
            Isolation::Committed => builder.read_committed(),
            Isolation::Repeatable => builder.repeatable_read(),
            Isolation::ReadOnly => builder.repeatable_read().read_only(),
        };

        builder
            .run(|conn| {
                async move {
                    let mut db_conn = DbConnection {
                        conn,
                        config,
                        isolation: Some(level),
                        task_queue,
                    };
                    cb(&mut db_conn).await
                }
                .scope_boxed()
            })
            .await
    }

    pub fn assert_in_transaction(&self) {
        assert!(self.isolation.is_some());
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
            .for_update()
            .get_result::<models::User>(self)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)?;

        if let Some(password_hash) = user.password.clone() {
            let password = password.to_owned();
            match spawn_blocking(span!(Level::INFO, "verify password",), move || {
                bcrypt::verify(password, &password_hash)
            })
            .await
            {
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

    pub async fn list_catalogs(&mut self) -> Result<Vec<String>> {
        let catalogs = models::Catalog::list(self).await?;
        Ok(catalogs.into_iter().map(|c| c.id).collect())
    }
}
