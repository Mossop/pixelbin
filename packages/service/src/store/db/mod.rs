pub(crate) mod functions;
pub(crate) mod models;
pub(crate) mod search;

use std::{
    fmt, mem,
    pin::{pin, Pin},
    task::{Context, Poll},
};

use chrono::{Duration, Utc};
use futures::{future::BoxFuture, stream::BoxStream, Future, FutureExt, Stream, StreamExt};
use pin_project::pin_project;
use pixelbin_migrations::{Migrator, Phase};
use serde::Serialize;
use sqlx::{
    pool::PoolConnection,
    postgres::{PgPoolOptions, PgQueryResult, PgRow, PgStatement},
    Acquire, Database, Either, Executor, Transaction,
};
use tracing::{error, field, info, instrument, span, span::Id, warn, Level, Span};

use crate::{
    shared::{long_id, record_error, spawn_blocking, DEFAULT_STATUS},
    store::{db::functions::from_row, Isolation},
    Config, Error, Result, Store, Task, TaskQueue,
};

type SqlxDatabase = sqlx::Postgres;
type SqlxResult<T> = sqlx::Result<T>;
pub(crate) type SqlxPool = sqlx::Pool<SqlxDatabase>;

const TOKEN_EXPIRY_DAYS: i64 = 90;

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MediaAccess {
    WritableCatalog,
    ReadableCatalog,
    PublicSearch,
    PublicMedia,
}

#[instrument(err, skip_all)]
pub(crate) async fn connect(
    config: &Config,
    task_span: Option<Id>,
) -> Result<(SqlxPool, TaskQueue)> {
    // Set up the async pool.
    let pool = PgPoolOptions::new()
        .min_connections(5)
        .max_connections(10)
        .connect(&config.database_url)
        .await?;

    {
        // Connect to perform migrations.
        let mut connection = pool.acquire().await?;
        let mut migrator = Migrator::new(&mut connection).await?;

        migrator.apply(&mut connection, None, |_, phase, migration| {
            match phase {
                Phase::Complete => info!(version = migration.version(), name=migration.name(), "Applied migration"),
                Phase::Error(e) => error!(version = migration.version(), name=migration.name(), error=?e, "Failed to apply migration"),
                _ => {}
            }
        }).await?;
    }

    let task_queue = TaskQueue::new(pool.clone(), config.clone(), task_span);

    // Verify that we can connect and update cached views.
    let mut conn = DbConnection::new(pool.clone(), config.clone(), task_queue.clone()).await?;

    sqlx::query!(r#"REFRESH MATERIALIZED VIEW "user_catalog";"#)
        .execute(&mut conn)
        .await?;
    sqlx::query!(r#"REFRESH MATERIALIZED VIEW "album_descendent";"#)
        .execute(&mut conn)
        .await?;
    sqlx::query!(r#"REFRESH MATERIALIZED VIEW "album_relation";"#)
        .execute(&mut conn)
        .await?;
    sqlx::query!(r#"REFRESH MATERIALIZED VIEW "tag_descendent";"#)
        .execute(&mut conn)
        .await?;
    sqlx::query!(r#"REFRESH MATERIALIZED VIEW "tag_relation";"#)
        .execute(&mut conn)
        .await?;
    sqlx::query!(r#"REFRESH MATERIALIZED VIEW "person_relation";"#)
        .execute(&mut conn)
        .await?;
    sqlx::query!(r#"REFRESH MATERIALIZED VIEW "media_file_alternates";"#)
        .execute(&mut conn)
        .await?;

    // Clear expired auth tokens.
    sqlx::query!("DELETE FROM auth_token WHERE expiry <= CURRENT_TIMESTAMP")
        .execute(&pool)
        .await?;

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

#[derive(Default)]
pub(super) enum Connection<'c> {
    #[default]
    None,
    Connected(PoolConnection<SqlxDatabase>),
    Transaction((Isolation, Transaction<'c, SqlxDatabase>)),
}

pub struct DbConnection<'conn> {
    pub(super) pool: SqlxPool,
    pub(super) connection: Connection<'conn>,
    pub(super) config: Config,
    pub(super) task_queue: TaskQueue,
}

impl<'conn> fmt::Debug for DbConnection<'conn> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("DbConnection")
            .field("config", &self.config)
            .finish()
    }
}

#[pin_project]
struct InstrumentedStream<'a> {
    #[pin]
    inner: BoxStream<'a, SqlxResult<Either<PgQueryResult, PgRow>>>,
    span: Span,
    rows_returned: u64,
    rows_affected: u64,
}

impl<'a> InstrumentedStream<'a>
where
    Self: Sized + Send + 'a,
{
    fn wrap(
        inner: BoxStream<'a, SqlxResult<Either<PgQueryResult, PgRow>>>,
        span: Span,
    ) -> BoxStream<'_, SqlxResult<Either<PgQueryResult, PgRow>>> {
        let instrumented = Self {
            inner,
            span,
            rows_returned: 0,
            rows_affected: 0,
        };

        instrumented.boxed()
    }
}

impl<'a> Stream for InstrumentedStream<'a> {
    type Item = SqlxResult<Either<PgQueryResult, PgRow>>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = self.project();
        let _entered = this.span.enter();

        let result = this.inner.poll_next(cx);

        match result {
            Poll::Ready(Some(Err(ref error))) => {
                record_error(this.span, &format!("{}", error));
            }
            Poll::Ready(Some(Ok(Either::Left(ref result)))) => {
                *this.rows_affected += result.rows_affected();
            }
            Poll::Ready(Some(Ok(Either::Right(_)))) => {
                *this.rows_returned += 1;
            }
            Poll::Ready(None) => {
                this.span
                    .record("db.query.rows_returned", this.rows_returned);
                this.span
                    .record("db.query.rows_affected", this.rows_affected);
            }
            _ => {}
        }

        result
    }
}

trait InstrumentationRecorder {
    fn record(&self, _span: &Span) {}
}

impl InstrumentationRecorder for SqlxResult<sqlx::Describe<SqlxDatabase>> {}

impl<'q> InstrumentationRecorder for SqlxResult<PgStatement<'q>> {}

impl InstrumentationRecorder for SqlxResult<Option<PgRow>> {
    fn record(&self, span: &Span) {
        if matches!(self, Ok(Some(_))) {
            span.record("db.query.rows_returned", 1);
            span.record("db.query.rows_affected", 1);
        } else {
            span.record("db.query.rows_returned", 0);
            span.record("db.query.rows_affected", 0);
        }
    }
}

#[pin_project]
struct InstrumentedFuture<'a, T> {
    #[pin]
    inner: BoxFuture<'a, SqlxResult<T>>,
    span: Span,
}

impl<'a, T> InstrumentedFuture<'a, T>
where
    Self: Sized + Send + 'a,
    SqlxResult<T>: InstrumentationRecorder,
    T: 'a,
{
    fn wrap(inner: BoxFuture<'a, SqlxResult<T>>, span: Span) -> BoxFuture<'a, SqlxResult<T>> {
        let instrumented = Self { inner, span };

        instrumented.boxed()
    }
}

impl<'a, T> Future for InstrumentedFuture<'a, T>
where
    SqlxResult<T>: InstrumentationRecorder,
{
    type Output = SqlxResult<T>;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let this = self.project();
        let _entered = this.span.enter();

        let result = this.inner.poll(cx);

        if let Poll::Ready(ref ready) = result {
            ready.record(this.span);
            if let Err(ref error) = ready {
                record_error(this.span, &format!("Database error: {}", error));
            }
        }

        result
    }
}

impl<'c, 'conn> Executor<'c> for &'c mut DbConnection<'conn>
where
    'conn: 'c,
{
    type Database = SqlxDatabase;

    fn fetch_many<'e, 'q: 'e, E>(
        self,
        query: E,
    ) -> BoxStream<'e, SqlxResult<sqlx::Either<PgQueryResult, PgRow>>>
    where
        'c: 'e,
        E: 'q + sqlx::Execute<'q, Self::Database>,
    {
        let span = span!(
            Level::TRACE,
            "DB fetch_many",
            "db.query.text" = query.sql(),
            "db.query.rows_returned" = field::Empty,
            "db.query.rows_affected" = field::Empty,
            "operation" = "fetch_many",
            "otel.status_code" = DEFAULT_STATUS,
            "otel.status_description" = field::Empty,
        );

        let inner = {
            let _entered = span.enter();

            match self.connection {
                Connection::None => panic!("Disconnected"),
                Connection::Connected(ref mut db_conn) => db_conn.fetch_many(query),
                Connection::Transaction((_, ref mut tx)) => tx.fetch_many(query),
            }
        };

        InstrumentedStream::wrap(inner, span)
    }

    fn fetch_optional<'e, 'q: 'e, E>(self, query: E) -> BoxFuture<'e, SqlxResult<Option<PgRow>>>
    where
        'c: 'e,
        E: 'q + sqlx::Execute<'q, Self::Database>,
    {
        let span = span!(
            Level::TRACE,
            "DB fetch_optional",
            "db.query.text" = query.sql(),
            "db.query.rows_returned" = field::Empty,
            "db.query.rows_affected" = field::Empty,
            "operation" = "fetch_optional",
            "otel.status_code" = DEFAULT_STATUS,
            "otel.status_description" = field::Empty,
        );

        let inner = {
            let _entered = span.enter();

            match self.connection {
                Connection::None => panic!("Disconnected"),
                Connection::Connected(ref mut db_conn) => db_conn.fetch_optional(query),
                Connection::Transaction((_, ref mut tx)) => tx.fetch_optional(query),
            }
        };

        InstrumentedFuture::wrap(inner, span)
    }

    fn prepare_with<'e, 'q: 'e>(
        self,
        sql: &'q str,
        parameters: &'e [<Self::Database as Database>::TypeInfo],
    ) -> BoxFuture<'e, SqlxResult<PgStatement<'q>>>
    where
        'c: 'e,
    {
        let span = span!(
            Level::TRACE,
            "DB prepare_with",
            "db.query.text" = sql,
            "operation" = "prepare_with",
            "otel.status_code" = DEFAULT_STATUS,
            "otel.status_description" = field::Empty,
        );

        let inner = {
            let _entered = span.enter();

            match self.connection {
                Connection::None => panic!("Disconnected"),
                Connection::Connected(ref mut db_conn) => db_conn.prepare_with(sql, parameters),
                Connection::Transaction((_, ref mut tx)) => tx.prepare_with(sql, parameters),
            }
        };

        InstrumentedFuture::wrap(inner, span)
    }

    fn describe<'e, 'q: 'e>(
        self,
        sql: &'q str,
    ) -> BoxFuture<'e, SqlxResult<sqlx::Describe<Self::Database>>>
    where
        'c: 'e,
    {
        let span = span!(
            Level::TRACE,
            "DB describe",
            "db.query.text" = sql,
            "operation" = "describe",
            "otel.status_code" = DEFAULT_STATUS,
            "otel.status_description" = field::Empty,
        );

        let inner = {
            let _entered = span.enter();

            match self.connection {
                Connection::None => panic!("Disconnected"),
                Connection::Connected(ref mut db_conn) => db_conn.describe(sql),
                Connection::Transaction((_, ref mut tx)) => tx.describe(sql),
            }
        };

        InstrumentedFuture::wrap(inner, span)
    }
}

impl DbConnection<'static> {
    pub(crate) async fn new(pool: SqlxPool, config: Config, task_queue: TaskQueue) -> Result<Self> {
        let db_connection = pool.acquire().await?;

        Ok(Self {
            pool,
            config,
            task_queue,
            connection: Connection::Connected(db_connection),
        })
    }
}

impl<'conn> Drop for DbConnection<'conn> {
    fn drop(&mut self) {
        if matches!(self.connection, Connection::Transaction(_)) {
            warn!("Dropping connection in the middle of a transaction. Transation will rollback");
        }
    }
}

impl<'conn> DbConnection<'conn> {
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

    pub async fn isolated<'c>(&'c mut self, level: Isolation) -> Result<DbConnection<'c>>
    where
        'conn: 'c,
    {
        let inner: Transaction<'c, SqlxDatabase> = match self.connection {
            Connection::None => panic!("Disconnected"),
            Connection::Connected(ref mut db_conn) => db_conn.begin().await?,
            Connection::Transaction((current_level, ref mut db_conn)) => {
                assert_eq!(current_level, level);
                db_conn.begin().await?
            }
        };

        Ok(DbConnection {
            connection: Connection::Transaction((level, inner)),
            pool: self.pool.clone(),
            config: self.config.clone(),
            task_queue: self.task_queue.clone(),
        })
    }

    pub async fn commit(mut self) -> Result<()> {
        if let Connection::Transaction((_, tx)) = mem::take(&mut self.connection) {
            tx.commit().await?;
        }

        Ok(())
    }

    pub async fn rollback(mut self) -> Result<()> {
        if let Connection::Transaction((_, tx)) = mem::take(&mut self.connection) {
            tx.rollback().await?;
        }

        Ok(())
    }

    pub async fn finish<T>(self, result: Result<T>) -> Result<T> {
        match result {
            Ok(t) => {
                self.commit().await?;
                Ok(t)
            }
            Err(e) => {
                self.rollback().await?;
                Err(e)
            }
        }
    }

    pub fn assert_in_transaction(&self) {
        assert!(matches!(self.connection, Connection::Transaction(_)));
    }

    pub fn config(&self) -> &Config {
        &self.config
    }

    #[instrument(skip_all)]
    pub(crate) async fn verify_credentials(
        &mut self,
        email: &str,
        password: &str,
    ) -> Result<(models::User, String)> {
        let mut user = sqlx::query!(
            r#"
            SELECT *
            FROM "user"
            WHERE "email"=$1
            FOR UPDATE
            "#,
            email
        )
        .map(|row| from_row!(User(row)))
        .fetch_one(&mut *self)
        .await?;

        if let Some(password_hash) = user.password.clone() {
            let password = password.to_owned();
            match spawn_blocking(span!(Level::TRACE, "verify password"), move || {
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

        sqlx::query!(
            "
            INSERT INTO auth_token (email, token, expiry)
            VALUES ($1,$2,$3)
            ",
            email,
            token,
            Some(Utc::now() + Duration::days(TOKEN_EXPIRY_DAYS))
        )
        .execute(&mut *self)
        .await?;

        user.last_login = Some(Utc::now());

        sqlx::query!(
            r#"
            UPDATE "user"
            SET last_login=$1
            WHERE "email"=$2
            "#,
            user.last_login,
            email,
        )
        .execute(self)
        .await?;

        Ok((user, token))
    }

    #[instrument(skip_all)]
    pub(crate) async fn verify_token(&mut self, token: &str) -> Result<Option<models::User>> {
        let expiry = Utc::now() + Duration::days(TOKEN_EXPIRY_DAYS);

        let email = match sqlx::query_scalar!(
            r#"
            UPDATE auth_token
            SET expiry=$1
            WHERE token=$2
            RETURNING "email"
            "#,
            expiry,
            token
        )
        .fetch_optional(&mut *self)
        .await?
        {
            Some(u) => u,
            None => return Ok(None),
        };

        let user = sqlx::query!(
            r#"
            UPDATE "user"
            SET last_login=CURRENT_TIMESTAMP
            WHERE "email"=$1
            RETURNING "user".*
            "#,
            email
        )
        .map(|row| from_row!(User(row)))
        .fetch_optional(self)
        .await?;

        Ok(user)
    }

    pub(crate) async fn delete_token(&mut self, token: &str) -> Result {
        sqlx::query!(
            "
            DELETE FROM auth_token
            WHERE token=$1
            ",
            token
        )
        .execute(self)
        .await?;

        Ok(())
    }

    pub async fn stats(&mut self) -> Result<StoreStats> {
        let users: i64 = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "user""#)
            .fetch_one(&mut *self)
            .await?;
        let catalogs: i64 = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "catalog""#)
            .fetch_one(&mut *self)
            .await?;
        let albums: i64 = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "album""#)
            .fetch_one(&mut *self)
            .await?;
        let tags: i64 = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "tag""#)
            .fetch_one(&mut *self)
            .await?;
        let people: i64 = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "person""#)
            .fetch_one(&mut *self)
            .await?;
        let media: i64 = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "media_item""#)
            .fetch_one(&mut *self)
            .await?;
        let files: i64 = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "media_file""#)
            .fetch_one(&mut *self)
            .await?;
        let alternate_files: i64 =
            sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "alternate_file""#)
                .fetch_one(&mut *self)
                .await?;

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
