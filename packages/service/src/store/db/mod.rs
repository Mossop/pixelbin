pub(crate) mod functions;
mod internal;
pub(crate) mod models;
pub(crate) mod search;

use std::{fmt, mem, time::Duration};

use pixelbin_migrations::{Migrator, Phase};
use serde::Serialize;
use sqlx::{
    pool::{PoolConnection, PoolConnectionMetadata, PoolOptions},
    Result as SqlxResult, Transaction,
};
use tracing::{error, info, instrument, trace, warn, Span};

use crate::{
    store::{db::internal::Connection, locks::Locks, StoreInner},
    worker::WorkerHost,
    Config, Result, Store, StoreType, Task, TaskQueue,
};

pub(crate) type SqlxDatabase = sqlx::Postgres;

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MediaAccess {
    WritableCatalog,
    ReadableCatalog,
    PublicSearch,
    PublicMedia,
}

#[derive(Default, Debug, Clone, Copy, PartialEq)]
pub enum Isolation {
    #[default]
    Committed,
    Repeatable,
    ReadOnly,
}

#[derive(Clone, Debug)]
pub(crate) struct DbPool {
    pool: sqlx::Pool<SqlxDatabase>,
}

impl DbPool {
    pub(crate) async fn connect(config: &Config, store_type: StoreType) -> SqlxResult<Self> {
        let (min_connections, max_connections) = match store_type {
            StoreType::Cli => (0, 10),
            StoreType::Server => (0, 2),
            StoreType::Worker => (0, 2),
        };

        Self::from_options(
            config,
            PoolOptions::<SqlxDatabase>::new()
                .min_connections(min_connections)
                .max_connections(max_connections),
        )
        .await
    }

    async fn after_connect(meta: PoolConnectionMetadata) -> SqlxResult<()> {
        let span = Span::current();
        if span.has_field("connection") {
            span.record("connection", "new");
            span.record("connection_idle_ms", meta.idle_for.as_millis());
            span.record("connection_age_ms", meta.age.as_millis());
        } else {
            trace!(
                connection_idle_ms = meta.idle_for.as_millis(),
                connection_age_ms = meta.age.as_millis(),
                "Established new connection"
            );
        }

        Ok(())
    }

    async fn before_acquire(meta: PoolConnectionMetadata) -> SqlxResult<bool> {
        let span = Span::current();
        if span.has_field("connection") {
            span.record("connection", "idle");
            span.record("connection_idle_ms", meta.idle_for.as_millis());
            span.record("connection_age_ms", meta.age.as_millis());
        } else {
            trace!(
                connection_idle_ms = meta.idle_for.as_millis(),
                connection_age_ms = meta.age.as_millis(),
                "Re-using idle connection"
            );
        }

        Ok(true)
    }

    pub(crate) async fn from_options(
        config: &Config,
        options: PoolOptions<SqlxDatabase>,
    ) -> SqlxResult<Self> {
        let pool = options
            .acquire_timeout(Duration::from_secs(60 * 5))
            .after_connect(|_conn, meta| Box::pin(Self::after_connect(meta)))
            .before_acquire(|_conn, meta| Box::pin(Self::before_acquire(meta)))
            .connect(&config.database_url)
            .await?;

        Ok(Self { pool })
    }

    #[instrument(skip_all, fields(connection, connection_idle_ms, connection_age_ms))]
    pub(crate) async fn acquire(&self) -> SqlxResult<PoolConnection<SqlxDatabase>> {
        self.pool.acquire().await
    }

    #[instrument(skip_all, fields(connection, connection_idle_ms, connection_age_ms))]
    pub(crate) async fn begin(&self) -> SqlxResult<Transaction<'static, SqlxDatabase>> {
        self.pool.begin().await
    }
}

#[instrument(err, skip_all)]
pub(crate) async fn connect(config: &Config, store_type: StoreType) -> Result<Store> {
    // Set up the async pool.
    let pool = DbPool::connect(config, store_type).await?;

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

    let mut task_queue = TaskQueue::new();

    let mut store: Store = StoreInner {
        store_type,
        pool,
        config: config.clone(),
        task_queue: task_queue.clone(),
        workers: WorkerHost::default(),
        locks: Locks::new(),
    }
    .into();

    match store_type {
        StoreType::Server => task_queue.spawn(store.clone(), 2),
        StoreType::Worker => task_queue.spawn(store.clone(), 1),
        _ => {}
    }

    // Verify that we can connect and update cached views.
    sqlx::query!(r#"REFRESH MATERIALIZED VIEW "user_catalog";"#)
        .execute(&mut store)
        .await?;
    sqlx::query!(r#"REFRESH MATERIALIZED VIEW "album_descendent";"#)
        .execute(&mut store)
        .await?;
    sqlx::query!(r#"REFRESH MATERIALIZED VIEW "album_relation";"#)
        .execute(&mut store)
        .await?;
    sqlx::query!(r#"REFRESH MATERIALIZED VIEW "tag_descendent";"#)
        .execute(&mut store)
        .await?;
    sqlx::query!(r#"REFRESH MATERIALIZED VIEW "tag_relation";"#)
        .execute(&mut store)
        .await?;
    sqlx::query!(r#"REFRESH MATERIALIZED VIEW "person_relation";"#)
        .execute(&mut store)
        .await?;
    sqlx::query!(r#"REFRESH MATERIALIZED VIEW "media_file_alternates";"#)
        .execute(&mut store)
        .await?;

    // Clear expired auth tokens.
    sqlx::query!("DELETE FROM auth_token WHERE expiry <= CURRENT_TIMESTAMP")
        .execute(&mut store)
        .await?;

    Ok(store)
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

impl StoreStats {
    pub async fn stats(conn: &mut DbConnection<'_>) -> Result<StoreStats> {
        let users: i64 = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "user""#)
            .fetch_one(&mut *conn)
            .await?;
        let catalogs: i64 = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "catalog""#)
            .fetch_one(&mut *conn)
            .await?;
        let albums: i64 = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "album""#)
            .fetch_one(&mut *conn)
            .await?;
        let tags: i64 = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "tag""#)
            .fetch_one(&mut *conn)
            .await?;
        let people: i64 = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "person""#)
            .fetch_one(&mut *conn)
            .await?;
        let media: i64 = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "media_item""#)
            .fetch_one(&mut *conn)
            .await?;
        let files: i64 = sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "media_file""#)
            .fetch_one(&mut *conn)
            .await?;
        let alternate_files: i64 =
            sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!" FROM "alternate_file""#)
                .fetch_one(&mut *conn)
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
}

pub struct DbConnection<'conn> {
    store_inner: StoreInner,
    connection: Connection<'conn>,
}

impl<'conn> fmt::Debug for DbConnection<'conn> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("DbConnection")
            .field("config", &self.config())
            .finish()
    }
}

impl DbConnection<'static> {
    pub(super) fn pooled(store_inner: StoreInner) -> Self {
        Self {
            connection: Connection::Pool(store_inner.pool.clone()),
            store_inner,
        }
    }

    pub(super) async fn connect(store_inner: StoreInner) -> Result<Self> {
        let db_connection = store_inner.pool.acquire().await?;

        Ok(Self {
            store_inner,
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
    pub(super) fn from_transaction(
        store: Store,
        isolation: Isolation,
        tx: Transaction<'conn, SqlxDatabase>,
    ) -> Self {
        DbConnection {
            store_inner: store.inner,
            connection: Connection::Transaction((isolation, tx)),
        }
    }

    pub async fn queue_task(&self, task: Task) {
        self.store_inner.task_queue.queue_task(task).await;
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
        &self.store_inner.config
    }

    pub async fn list_catalogs(&mut self) -> Result<Vec<String>> {
        let catalogs = models::Catalog::list(self).await?;
        Ok(catalogs.into_iter().map(|c| c.id).collect())
    }
}

pub(crate) trait AsDb<'conn> {
    fn as_db(&mut self) -> &mut DbConnection<'conn>;
}

impl AsDb<'static> for Store {
    fn as_db(&mut self) -> &mut DbConnection<'static> {
        self
    }
}

impl<'conn> AsDb<'conn> for DbConnection<'conn> {
    fn as_db(&mut self) -> &mut DbConnection<'conn> {
        self
    }
}

impl<'conn> AsDb<'conn> for &'conn mut DbConnection<'conn> {
    fn as_db(&mut self) -> &mut DbConnection<'conn> {
        self
    }
}
