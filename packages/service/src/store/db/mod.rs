pub(crate) mod functions;
pub(crate) mod models;
#[allow(unreachable_pub)]
pub(super) mod schema;
pub(crate) mod search;
pub(super) mod views;

use std::{
    ops::{Deref, DerefMut},
    pin::{pin, Pin},
    task::{Context, Poll},
};

use chrono::{Duration, Utc};
use diesel::{
    connection::Instrumentation,
    debug_query,
    dsl::now,
    migration::{Migration, MigrationSource},
    pg::Pg,
    prelude::*,
    query_builder::{AsQuery, QueryFragment, QueryId},
    sql_query,
};
use diesel_async::{
    pooled_connection::{
        deadpool::{Object, Pool},
        AsyncDieselConnectionManager,
    },
    scoped_futures::ScopedFutureExt,
    AsyncConnection, AsyncPgConnection, RunQueryDsl, SimpleAsyncConnection, TransactionManager,
};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use futures::{Future, Stream};
use pin_project::pin_project;
use schema::*;
use scoped_futures::ScopedBoxFuture;
use tracing::{field, info, instrument, span, span::Id, trace, Level, Span};

use crate::{
    metadata::{alternates_for_media_file, parse_metadata, METADATA_FILE},
    shared::{file_exists, long_id, record_error, spawn_blocking, DEFAULT_STATUS},
    store::{db::functions::media_file_columns, path::MediaFileStore, Isolation},
    Config, Error, Result, Store, Task, TaskQueue,
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
        let media_file_store = MediaFileStore {
            catalog,
            item: media_file.media_item.clone(),
            file: media_file.id.clone(),
        };

        let metadata_path = local_store.local_path(&media_file_store.file(METADATA_FILE));
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
    let mut reprocess_media = false;
    let mut update_search_date = false;
    let mut update_alternates = false;

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
            "2024-08-10-105759_public_media_item" => {
                update_alternates = true;
            }
            _ => {}
        }
    }

    // Now set up the async pool.
    let pool_config = AsyncDieselConnectionManager::<BackendConnection>::new(&config.database_url);
    let pool = Pool::builder(pool_config).build()?;
    let task_queue = TaskQueue::new(pool.clone(), config.clone(), task_span);

    // Verify that we can connect and update cached views.
    let mut conn = DbConnection::new(pool.clone(), config, &task_queue).await?;

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
        trace!("Reprocessing all media metadata");
        conn.isolated(Isolation::Committed, |conn| {
            reprocess_all_media(conn).scope_boxed()
        })
        .await?;
    }

    if update_search_queries {
        trace!("Upgrading search queries");
        conn.isolated(Isolation::Committed, |conn| {
            models::SavedSearch::upgrade_queries(conn).scope_boxed()
        })
        .await?;
    }

    if update_search_date {
        trace!("Updating search dates");
        update_search_dates(&mut conn).await?;
    }

    if update_alternates {
        trace!("Rebuilding missing alternate files");

        let mut media_items = Vec::new();
        for catalog in models::Catalog::list(&mut conn).await? {
            media_items.extend(models::MediaItem::list_public(&mut conn, &catalog.id).await?);
        }

        let mut alternates_to_update = Vec::new();

        for (media_file, media_file_store) in
            models::MediaFile::list_for_items(&mut conn, &media_items).await?
        {
            let alternates = alternates_for_media_file(conn.config(), &media_file, true);

            alternates_to_update.push((media_file, media_file_store, alternates));
        }

        models::AlternateFile::sync_for_media_files(&mut conn, alternates_to_update).await?;
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

enum Conn<'a> {
    Owned(Object<BackendConnection>),
    Borrowed(&'a mut BackendConnection),
}

impl<'a> Deref for Conn<'a> {
    type Target = BackendConnection;

    fn deref(&self) -> &Self::Target {
        match self {
            Conn::Owned(ref c) => c,
            Conn::Borrowed(c) => c,
        }
    }
}

impl<'a> DerefMut for Conn<'a> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        match self {
            Conn::Owned(ref mut c) => c.deref_mut(),
            Conn::Borrowed(c) => c,
        }
    }
}

#[pin_project]
pub struct LoadStream<'conn, 'query> {
    #[pin]
    inner: <BackendConnection as AsyncConnection>::Stream<'conn, 'query>,
    span: Span,
}

impl<'conn, 'query> LoadStream<'conn, 'query> {
    fn new(
        inner: <BackendConnection as AsyncConnection>::Stream<'conn, 'query>,
        span: Span,
    ) -> Self {
        Self { inner, span }
    }
}

impl<'conn, 'query> Stream for LoadStream<'conn, 'query> {
    type Item = QueryResult<<BackendConnection as AsyncConnection>::Row<'conn, 'query>>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = self.project();
        let _entered = this.span.enter();

        let result = this.inner.poll_next(cx);

        if let Poll::Ready(Some(Err(ref error))) = result {
            record_error(this.span, &format!("Database error: {}", error));
        }

        result
    }
}

#[pin_project]
pub struct LoadFuture<'conn, 'query> {
    #[pin]
    inner: <BackendConnection as AsyncConnection>::LoadFuture<'conn, 'query>,
    span: Span,
}

impl<'conn, 'query> LoadFuture<'conn, 'query> {
    fn new<F>(query: String, cb: F) -> Self
    where
        F: FnOnce() -> <BackendConnection as AsyncConnection>::LoadFuture<'conn, 'query>,
    {
        let span = span!(
            Level::INFO,
            "database_query",
            "query" = query,
            "operation" = "load",
            "otel.status_code" = DEFAULT_STATUS,
            "otel.status_description" = field::Empty,
        );

        let inner = {
            let _entered = span.enter();
            cb()
        };

        Self { inner, span }
    }
}

impl<'conn, 'query> Future for LoadFuture<'conn, 'query> {
    type Output = QueryResult<LoadStream<'conn, 'query>>;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let this = self.project();
        let _entered = this.span.enter();

        match this.inner.poll(cx) {
            Poll::Ready(Ok(stream)) => Poll::Ready(Ok(LoadStream::new(stream, this.span.clone()))),
            Poll::Ready(Err(error)) => {
                record_error(this.span, &format!("Database error: {}", error));
                Poll::Ready(Err(error))
            }
            Poll::Pending => Poll::Pending,
        }
    }
}

#[pin_project]
pub struct ExecuteFuture<'conn, 'query> {
    #[pin]
    inner: <BackendConnection as AsyncConnection>::ExecuteFuture<'conn, 'query>,
    span: Span,
}

impl<'conn, 'query> ExecuteFuture<'conn, 'query> {
    fn new<F>(query: String, cb: F) -> Self
    where
        F: FnOnce() -> <BackendConnection as AsyncConnection>::ExecuteFuture<'conn, 'query>,
    {
        let span = span!(
            Level::INFO,
            "database_query",
            "query" = query,
            "operation" = "execute_returning_count",
            "otel.status_code" = DEFAULT_STATUS,
            "otel.status_description" = field::Empty,
        );

        let inner = {
            let _entered = span.enter();
            cb()
        };

        Self { inner, span }
    }
}

impl<'conn, 'query> Future for ExecuteFuture<'conn, 'query> {
    type Output = QueryResult<usize>;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let this = self.project();
        let _entered = this.span.enter();

        let result = this.inner.poll(cx);

        if let Poll::Ready(Err(error)) = &result {
            record_error(this.span, &format!("Database error: {}", error))
        }

        result
    }
}

pub struct DbConnection<'conn> {
    pool: DbPool,
    conn: Conn<'conn>,
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
    type ExecuteFuture<'conn, 'query> = ExecuteFuture<'conn, 'query>;

    type LoadFuture<'conn, 'query> = LoadFuture<'conn, 'query>;

    type Stream<'conn, 'query> = LoadStream<'conn, 'query>;

    type Row<'conn, 'query> = <BackendConnection as AsyncConnection>::Row<'conn, 'query>;

    type Backend = <BackendConnection as AsyncConnection>::Backend;
    type TransactionManager = <BackendConnection as AsyncConnection>::TransactionManager;

    fn establish<'life0, 'async_trait>(
        _database_url: &'life0 str,
    ) -> Pin<Box<dyn Future<Output = ConnectionResult<Self>> + Send + 'async_trait>>
    where
        'life0: 'async_trait,
        Self: 'async_trait,
    {
        unimplemented!();
    }

    fn load<'conn, 'query, T>(&'conn mut self, source: T) -> Self::LoadFuture<'conn, 'query>
    where
        T: AsQuery + 'query,
        T::Query: QueryFragment<Self::Backend> + QueryId + 'query,
    {
        let query = source.as_query();

        LoadFuture::new(debug_query(&query).to_string(), move || {
            AsyncConnection::load(&mut self.conn, query)
        })
    }

    fn execute_returning_count<'conn, 'query, T>(
        &'conn mut self,
        source: T,
    ) -> Self::ExecuteFuture<'conn, 'query>
    where
        T: QueryFragment<Self::Backend> + QueryId + 'query,
    {
        ExecuteFuture::new(debug_query(&source).to_string(), move || {
            AsyncConnection::execute_returning_count(&mut self.conn, source)
        })
    }

    fn transaction_state(
        &mut self,
    ) -> &mut <Self::TransactionManager as TransactionManager<Self>>::TransactionStateData {
        AsyncConnection::transaction_state(&mut self.conn)
    }

    fn instrumentation(&mut self) -> &mut dyn Instrumentation {
        AsyncConnection::instrumentation(&mut self.conn)
    }

    fn set_instrumentation(&mut self, instrumentation: impl Instrumentation) {
        AsyncConnection::set_instrumentation(&mut self.conn, instrumentation)
    }
}

impl<'conn> DbConnection<'conn> {
    pub(crate) async fn new(pool: DbPool, config: &Config, task_queue: &TaskQueue) -> Result<Self> {
        let conn = pool.get().await?;

        Ok(Self {
            pool,
            conn: Conn::Owned(conn),
            config: config.clone(),
            isolation: None,
            task_queue: task_queue.clone(),
        })
    }

    pub fn store(&self) -> Store {
        Store {
            pool: self.pool.clone(),
            config: self.config.clone(),
            task_queue: self.task_queue.clone(),
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
                pool: self.pool.clone(),
                conn: Conn::Borrowed(&mut self.conn),
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

        let pool = self.pool.clone();
        builder
            .run(|conn| {
                async move {
                    let mut db_conn = DbConnection {
                        pool,
                        conn: Conn::Borrowed(conn),
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

    #[instrument(skip_all)]
    pub(crate) async fn verify_token(&mut self, token: &str) -> Result<Option<models::User>> {
        let expiry = Utc::now() + Duration::days(TOKEN_EXPIRY_DAYS);

        let email = match diesel::update(auth_token::table)
            .filter(auth_token::token.eq(token))
            .set(auth_token::expiry.eq(expiry))
            .returning(auth_token::email)
            .get_result::<String>(self)
            .await
            .optional()?
        {
            Some(u) => u,
            None => return Ok(None),
        };

        let user = diesel::update(user::table)
            .filter(user::email.eq(&email))
            .set(user::last_login.eq(Some(Utc::now())))
            .returning(user::all_columns)
            .get_result::<models::User>(self)
            .await
            .optional()?;

        Ok(user)
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
