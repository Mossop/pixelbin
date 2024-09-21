use std::{
    pin::{pin, Pin},
    sync::{Arc, Mutex},
    task::{Context, Poll},
};

use futures::{
    future::{poll_fn, BoxFuture, Fuse, FusedFuture},
    stream::BoxStream,
    Future, FutureExt, Stream, StreamExt, TryStreamExt,
};
use pin_project::pin_project;
use sqlx::{
    pool::PoolConnection,
    postgres::{PgQueryResult, PgRow, PgStatement},
    Database, Either, Error as SqlxError, Executor, Transaction,
};
use tracing::{field, span, Instrument, Level, Span};

use crate::{
    shared::{record_error, DEFAULT_STATUS},
    store::db::SqlxPool,
    Isolation, Store,
};

use super::{DbConnection, SqlxDatabase};

type SqlxResult<T> = sqlx::Result<T>;

#[derive(Default, Debug)]
pub(super) enum Connection<'c> {
    #[default]
    None,
    Pool(SqlxPool),
    Connected(PoolConnection<SqlxDatabase>),
    Transaction((Isolation, Transaction<'c, SqlxDatabase>)),
}

struct TryAsyncStream<'a, T> {
    yielder: Yielder<T>,
    future: Fuse<BoxFuture<'a, Result<(), SqlxError>>>,
}

impl<'a, T> TryAsyncStream<'a, T> {
    fn new<F, Fut>(f: F, span: Span) -> Self
    where
        F: FnOnce(Yielder<T>) -> Fut + Send,
        Fut: 'a + Future<Output = Result<(), SqlxError>> + Send,
        T: 'a + Send,
    {
        let yielder = Yielder::new();

        let future = f(yielder.duplicate()).instrument(span).boxed().fuse();

        Self { future, yielder }
    }
}

struct Yielder<T> {
    // This mutex should never have any contention in normal operation.
    // We're just using it because `Rc<Cell<Option<T>>>` would not be `Send`.
    value: Arc<Mutex<Option<T>>>,
}

impl<T> Yielder<T> {
    fn new() -> Self {
        Yielder {
            value: Arc::new(Mutex::new(None)),
        }
    }

    // Don't want to expose a `Clone` impl
    fn duplicate(&self) -> Self {
        Yielder {
            value: self.value.clone(),
        }
    }

    /// NOTE: may deadlock the task if called from outside the future passed to `TryAsyncStream`.
    async fn yielded(&self, val: T) {
        let replaced = self
            .value
            .lock()
            .expect("BUG: panicked while holding a lock")
            .replace(val);

        debug_assert!(
            replaced.is_none(),
            "BUG: previously yielded value not taken"
        );

        let mut yielded = false;

        // Allows the generating future to suspend its execution without changing the task priority,
        // which would happen with `tokio::task::yield_now()`.
        //
        // Note that because this has no way to schedule a wakeup, this could deadlock the task
        // if called in the wrong place.
        poll_fn(|_cx| {
            if !yielded {
                yielded = true;
                Poll::Pending
            } else {
                Poll::Ready(())
            }
        })
        .await
    }

    fn take(&self) -> Option<T> {
        self.value
            .lock()
            .expect("BUG: panicked while holding a lock")
            .take()
    }
}

impl<'a, T> Stream for TryAsyncStream<'a, T> {
    type Item = Result<T, SqlxError>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        if self.future.is_terminated() {
            return Poll::Ready(None);
        }

        match self.future.poll_unpin(cx) {
            Poll::Ready(Ok(())) => {
                // Future returned without yielding another value,
                // or else it would have returned `Pending` instead.
                Poll::Ready(None)
            }
            Poll::Ready(Err(e)) => Poll::Ready(Some(Err(e))),
            Poll::Pending => self
                .yielder
                .take()
                .map_or(Poll::Pending, |val| Poll::Ready(Some(Ok(val)))),
        }
    }
}

#[pin_project]
struct InstrumentedStream<S> {
    #[pin]
    inner: S,
    span: Span,
    rows_returned: u64,
    rows_affected: u64,
}

impl<'a, S> InstrumentedStream<S>
where
    Self: Send,
    S: 'a + Stream<Item = SqlxResult<Either<PgQueryResult, PgRow>>>,
{
    fn wrap_stream(
        inner: S,
        span: Span,
    ) -> BoxStream<'a, SqlxResult<Either<PgQueryResult, PgRow>>> {
        let instrumented = Self {
            inner,
            span,
            rows_returned: 0,
            rows_affected: 0,
        };

        instrumented.boxed()
    }
}

impl<S> Stream for InstrumentedStream<S>
where
    S: Stream<Item = SqlxResult<Either<PgQueryResult, PgRow>>>,
{
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
struct InstrumentedFuture<I, T>
where
    I: Future<Output = SqlxResult<T>>,
{
    #[pin]
    inner: I,
    span: Span,
}

impl<'a, I, T> InstrumentedFuture<I, T>
where
    Self: Send,
    I: 'a + Future<Output = SqlxResult<T>>,
    T: 'a,
    SqlxResult<T>: InstrumentationRecorder,
{
    fn wrap(inner: I, span: Span) -> BoxFuture<'a, SqlxResult<T>>
    where
        I: Future<Output = SqlxResult<T>> + 'a,
    {
        let instrumented = Self { inner, span };

        instrumented.boxed()
    }
}

impl<I, T> Future for InstrumentedFuture<I, T>
where
    I: Future<Output = SqlxResult<T>>,
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

impl<'c, 'conn> Executor<'c> for &'c mut Connection<'conn>
where
    'conn: 'c,
{
    type Database = SqlxDatabase;

    fn fetch_many<'e, 'q, E>(
        self,
        query: E,
    ) -> BoxStream<'e, SqlxResult<sqlx::Either<PgQueryResult, PgRow>>>
    where
        'q: 'e,
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

        let _entered = span.clone().entered();

        match self {
            Connection::None => panic!("Disconnected"),
            Connection::Pool(pool) => InstrumentedStream::wrap_stream(
                TryAsyncStream::new(
                    move |yielder| async move {
                        // Anti-footgun: effectively pins `yielder` to this future to prevent any accidental
                        // move to another task, which could deadlock.
                        let yielder = &yielder;

                        let mut conn = pool.acquire().await?;
                        let mut s = conn.fetch_many(query);

                        while let Some(v) = s.try_next().await? {
                            yielder.yielded(v).await;
                        }

                        Ok(())
                    },
                    span.clone(),
                ),
                span,
            ),
            Connection::Connected(ref mut db_conn) => {
                InstrumentedStream::wrap_stream(db_conn.fetch_many(query), span)
            }
            Connection::Transaction((_, ref mut tx)) => {
                InstrumentedStream::wrap_stream(tx.fetch_many(query), span)
            }
        }
    }

    fn fetch_optional<'e, 'q, E>(self, query: E) -> BoxFuture<'e, SqlxResult<Option<PgRow>>>
    where
        'q: 'e,
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

        let _entered = span.clone().entered();

        match self {
            Connection::None => panic!("Disconnected"),
            Connection::Pool(pool) => InstrumentedFuture::wrap(
                async {
                    match pool.acquire().await {
                        Ok(mut conn) => conn.fetch_optional(query).await,
                        Err(e) => Err(e),
                    }
                },
                span,
            ),
            Connection::Connected(ref mut db_conn) => {
                InstrumentedFuture::wrap(db_conn.fetch_optional(query), span)
            }
            Connection::Transaction((_, ref mut tx)) => {
                InstrumentedFuture::wrap(tx.fetch_optional(query), span)
            }
        }
    }

    fn prepare_with<'e, 'q>(
        self,
        sql: &'q str,
        parameters: &'e [<Self::Database as Database>::TypeInfo],
    ) -> BoxFuture<'e, SqlxResult<PgStatement<'q>>>
    where
        'q: 'e,
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

        let _entered = span.clone().entered();

        match self {
            Connection::None => panic!("Disconnected"),
            Connection::Pool(pool) => InstrumentedFuture::wrap(
                async {
                    match pool.acquire().await {
                        Ok(mut conn) => conn.prepare_with(sql, parameters).await,
                        Err(e) => Err(e),
                    }
                },
                span,
            ),
            Connection::Connected(ref mut db_conn) => {
                InstrumentedFuture::wrap(db_conn.prepare_with(sql, parameters), span)
            }
            Connection::Transaction((_, ref mut tx)) => {
                InstrumentedFuture::wrap(tx.prepare_with(sql, parameters), span)
            }
        }
    }

    fn describe<'e, 'q>(
        self,
        sql: &'q str,
    ) -> BoxFuture<'e, SqlxResult<sqlx::Describe<Self::Database>>>
    where
        'q: 'e,
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

        let _entered = span.clone().entered();

        match self {
            Connection::None => panic!("Disconnected"),
            Connection::Pool(pool) => InstrumentedFuture::wrap(
                async {
                    match pool.acquire().await {
                        Ok(mut conn) => conn.describe(sql).await,
                        Err(e) => Err(e),
                    }
                },
                span,
            ),
            Connection::Connected(ref mut db_conn) => {
                InstrumentedFuture::wrap(db_conn.describe(sql), span)
            }
            Connection::Transaction((_, ref mut tx)) => {
                InstrumentedFuture::wrap(tx.describe(sql), span)
            }
        }
    }
}

impl<'c, 'conn> Executor<'c> for &'c mut DbConnection<'conn> {
    type Database = SqlxDatabase;

    fn fetch_many<'e, 'q, E>(
        self,
        query: E,
    ) -> BoxStream<'e, SqlxResult<sqlx::Either<PgQueryResult, PgRow>>>
    where
        'q: 'e,
        'c: 'e,
        E: 'q + sqlx::Execute<'q, Self::Database>,
    {
        self.connection.fetch_many(query)
    }

    fn fetch_optional<'e, 'q, E>(self, query: E) -> BoxFuture<'e, SqlxResult<Option<PgRow>>>
    where
        'q: 'e,
        'c: 'e,
        E: 'q + sqlx::Execute<'q, Self::Database>,
    {
        self.connection.fetch_optional(query)
    }

    fn prepare_with<'e, 'q>(
        self,
        sql: &'q str,
        parameters: &'e [<Self::Database as Database>::TypeInfo],
    ) -> BoxFuture<'e, SqlxResult<PgStatement<'q>>>
    where
        'q: 'e,
        'c: 'e,
    {
        self.connection.prepare_with(sql, parameters)
    }

    fn describe<'e, 'q: 'e>(
        self,
        sql: &'q str,
    ) -> BoxFuture<'e, SqlxResult<sqlx::Describe<Self::Database>>>
    where
        'c: 'e,
    {
        self.connection.describe(sql)
    }
}

impl<'c> Executor<'c> for &'c mut Store {
    type Database = SqlxDatabase;

    fn fetch_many<'e, 'q, E>(
        self,
        query: E,
    ) -> BoxStream<'e, SqlxResult<sqlx::Either<PgQueryResult, PgRow>>>
    where
        'q: 'e,
        'c: 'e,
        E: 'q + sqlx::Execute<'q, Self::Database>,
    {
        self.pooled.fetch_many(query)
    }

    fn fetch_optional<'e, 'q, E>(self, query: E) -> BoxFuture<'e, SqlxResult<Option<PgRow>>>
    where
        'q: 'e,
        'c: 'e,
        E: 'q + sqlx::Execute<'q, Self::Database>,
    {
        self.pooled.fetch_optional(query)
    }

    fn prepare_with<'e, 'q>(
        self,
        sql: &'q str,
        parameters: &'e [<Self::Database as Database>::TypeInfo],
    ) -> BoxFuture<'e, SqlxResult<PgStatement<'q>>>
    where
        'q: 'e,
        'c: 'e,
    {
        self.pooled.prepare_with(sql, parameters)
    }

    fn describe<'e, 'q: 'e>(
        self,
        sql: &'q str,
    ) -> BoxFuture<'e, SqlxResult<sqlx::Describe<Self::Database>>>
    where
        'c: 'e,
    {
        self.pooled.describe(sql)
    }
}
