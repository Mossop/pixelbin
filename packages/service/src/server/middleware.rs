use std::{
    cmp::{max, Ordering},
    collections::HashMap,
    net::SocketAddr,
    result,
    sync::Arc,
    time::{Duration, Instant},
};

use actix_web::{
    body::{EitherBody, MessageBody},
    dev::{ServiceRequest, ServiceResponse},
    http::{header::HeaderMap, StatusCode},
    middleware::Next,
    web::Data,
    Error, FromRequest, HttpRequest, HttpResponse,
};
use chrono::{DateTime, Utc};
use futures::TryFutureExt;
use opentelemetry::{global, propagation::Extractor};
use tokio::sync::RwLock;
use tracing::{error, field, instrument, span, trace, warn, Instrument, Level, Span};
use tracing_opentelemetry::OpenTelemetrySpanExt;

use crate::{
    server::AppState,
    shared::{record_error, DEFAULT_STATUS},
    store::db::DbConnection,
    Result, Store,
};

const PRUNE_INTERVAL_SECS: u64 = 60 * 20;

#[derive(Clone, Copy, Eq)]
struct BlockState {
    status: StatusCode,
    expiry: Instant,
}

impl PartialEq for BlockState {
    fn eq(&self, other: &Self) -> bool {
        self.expiry == other.expiry
    }
}

impl Ord for BlockState {
    fn cmp(&self, other: &Self) -> Ordering {
        // For now we just care about expiry. A longer expiry is a "larger" block state.
        self.expiry.cmp(&other.expiry)
    }
}

impl PartialOrd for BlockState {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

struct RequestTrackerInner {
    next_update: Instant,
    blocks: HashMap<String, BlockState>,
}

impl RequestTrackerInner {
    fn new() -> Self {
        Self {
            next_update: Instant::now() + Duration::from_secs(PRUNE_INTERVAL_SECS),
            blocks: HashMap::new(),
        }
    }

    fn insert_block(&mut self, client: String, block: BlockState) -> bool {
        let mut updated = false;

        self.blocks
            .entry(client)
            .and_modify(|current| {
                if block > *current {
                    updated = true;
                    *current = block;
                }
            })
            .or_insert_with(|| {
                updated = true;
                block
            });

        updated
    }

    fn prune(&mut self) {
        let now = Instant::now();

        self.blocks.retain(|_, block| block.expiry > now);
        self.next_update = Instant::now() + Duration::from_secs(PRUNE_INTERVAL_SECS);
    }
}

#[derive(Clone)]
pub(super) struct RequestTracker {
    store: Store,
    inner: Arc<RwLock<RequestTrackerInner>>,
}

impl RequestTracker {
    pub(super) async fn new(store: Store) -> Self {
        let mut inner = RequestTrackerInner::new();

        if let Err(error) = Self::init_blocks(&store, &mut inner).await {
            error!(error = %error, "Failed to load block list.");
        }

        Self {
            store,
            inner: Arc::new(RwLock::new(inner)),
        }
    }

    async fn prune_database(conn: &mut DbConnection<'_>) -> Result {
        let limit = conn
            .config()
            .rate_limits
            .iter()
            .fold(Duration::from_secs(0), |largest, limit| {
                max(largest, limit.duration)
            });

        sqlx::query!(
            "DELETE FROM client_error WHERE request_time < $1",
            Utc::now() - limit
        )
        .execute(conn)
        .await?;

        Ok(())
    }

    async fn init_blocks(store: &Store, inner: &mut RequestTrackerInner) -> Result {
        let mut conn = store.connect().await?;

        Self::prune_database(&mut conn).await?;

        let utc_now = Utc::now();
        let now = Instant::now();

        for rate_limit in &store.config().rate_limits {
            let since = utc_now - rate_limit.duration;

            let list: Vec<(String, i64, DateTime<Utc>)> = if let Some(status) = rate_limit.status {
                sqlx::query!(
                    "
                    SELECT client, COUNT(status_code) AS count, MAX(request_time) AS last
                    FROM client_error
                    WHERE request_time > $1 AND status_code = $2
                    GROUP BY client
                    ",
                    since,
                    status as i32
                )
                .map(|row| (row.client, row.count.unwrap_or_default(), row.last.unwrap()))
                .fetch_all(&mut conn)
                .await?
            } else {
                sqlx::query!(
                    "
                    SELECT client, COUNT(status_code) AS count, MAX(request_time) AS last
                    FROM client_error
                    WHERE request_time > $1
                    GROUP BY client
                    ",
                    since
                )
                .map(|row| (row.client, row.count.unwrap_or_default(), row.last.unwrap()))
                .fetch_all(&mut conn)
                .await?
            };

            for (client, count, last) in list {
                if count > rate_limit.limit as i64 {
                    if let Ok(time_served) = (utc_now - last).to_std() {
                        if rate_limit.block_time > time_served {
                            let time_remaining = rate_limit.block_time - time_served;

                            let block = BlockState {
                                status: StatusCode::FORBIDDEN,
                                expiry: now + time_remaining,
                            };

                            inner.insert_block(client, block);
                        }
                    }
                }
            }
        }

        Ok(())
    }

    async fn prune_blocks(self) -> Result {
        let mut conn = self.store.connect().await?;

        Self::prune_database(&mut conn).await?;

        let mut inner = self.inner.write().await;
        inner.prune();

        Ok(())
    }

    async fn check_request(&self, client_addr: &Option<String>) -> Option<StatusCode> {
        if let Some(client) = client_addr {
            let inner = self.inner.read().await;

            if inner.next_update < Instant::now() {
                tokio::spawn(
                    self.clone()
                        .prune_blocks()
                        .unwrap_or_else(|error| error!(error=%error, "Error pruning block status")),
                );
            }

            if let Some(state) = inner.blocks.get(client) {
                if state.expiry > Instant::now() {
                    return Some(state.status);
                }
            }
        }

        None
    }

    #[instrument(skip(self))]
    async fn record_block_status(self, client_addr: String, status: StatusCode) -> Result {
        let mut conn = self.store.connect().await?;

        Self::prune_database(&mut conn).await?;

        sqlx::query!(
            "
            INSERT INTO client_error (client, request_time, status_code)
            VALUES ($1, CURRENT_TIMESTAMP, $2)
            ",
            &client_addr,
            status.as_u16() as i32
        )
        .execute(&mut conn)
        .await?;

        let mut new_block: Option<BlockState> = None;
        let utc_now = Utc::now();
        let now = Instant::now();

        for rate_limit in &self.store.config().rate_limits {
            let since = utc_now - rate_limit.duration;

            let count: i64 = if let Some(status) = rate_limit.status {
                sqlx::query!(
                    "
                    SELECT COUNT(status_code) AS count
                    FROM client_error
                    WHERE request_time > $1 AND client = $2 AND status_code = $3
                    ",
                    since,
                    &client_addr,
                    status as i32
                )
                .map(|row| row.count.unwrap_or_default())
                .fetch_optional(&mut conn)
                .await?
                .unwrap_or_default()
            } else {
                sqlx::query!(
                    "
                    SELECT COUNT(status_code) AS count
                    FROM client_error
                    WHERE request_time > $1 AND client = $2
                    ",
                    since,
                    &client_addr
                )
                .map(|row| row.count.unwrap_or_default())
                .fetch_optional(&mut conn)
                .await?
                .unwrap_or_default()
            };

            if count > rate_limit.limit as i64 {
                let block = BlockState {
                    status: StatusCode::FORBIDDEN,
                    expiry: now + rate_limit.block_time,
                };

                if let Some(ref mut current) = new_block {
                    if block > *current {
                        *current = block;
                    }
                } else {
                    new_block = Some(block);
                }
            }
        }

        let mut inner = self.inner.write().await;
        inner.prune();

        if let Some(block) = new_block {
            if inner.insert_block(client_addr.clone(), block) {
                let secs = (block.expiry - now).as_secs();
                trace!(
                    client = client_addr,
                    duration = secs,
                    "Client is now blocked"
                )
            }
        }

        Ok(())
    }

    fn record_response(&self, client_addr: &Option<String>, status: StatusCode) {
        if let Some(client) = client_addr {
            if status.is_client_error() {
                tokio::spawn(
                    self.clone()
                        .record_block_status(client.clone(), status)
                        .unwrap_or_else(
                            |error| error!(error=%error, "Error recording block status"),
                        ),
                );
            }
        }
    }
}

fn is_safe(addr: SocketAddr) -> bool {
    match addr {
        SocketAddr::V4(addr) => {
            let ip = addr.ip();
            ip.is_private() || ip.is_loopback() || ip.is_link_local()
        }
        SocketAddr::V6(addr) => addr.ip().is_loopback(),
    }
}

fn client_addr(req: &HttpRequest) -> Option<String> {
    if let Some(addr) = req.peer_addr() {
        if is_safe(addr) {
            if let Some(ip) = req.connection_info().realip_remote_addr() {
                return Some(ip.to_owned());
            }
        }

        Some(addr.to_string())
    } else {
        None
    }
}

struct TextMapExtractor<'a> {
    headers: &'a HeaderMap,
}

impl<'a> Extractor for TextMapExtractor<'a> {
    fn get(&self, key: &str) -> Option<&str> {
        self.headers.get(key).and_then(|v| v.to_str().ok())
    }

    fn keys(&self) -> Vec<&str> {
        self.headers.keys().map(|h| h.as_str()).collect()
    }
}

#[instrument(skip_all)]
pub(super) async fn middleware<B: MessageBody>(
    req: ServiceRequest,
    next: Next<B>,
) -> result::Result<ServiceResponse<EitherBody<B>>, Error> {
    let http_request = req.request();
    let app_data = Data::<AppState>::extract(http_request).await?;

    let headers = http_request.headers();
    let extractor = TextMapExtractor { headers };

    let parent_context =
        global::get_text_map_propagator(|propagator| propagator.extract(&extractor));
    Span::current().set_parent(parent_context);

    let span = span!(
        Level::TRACE,
        "api request",
        "duration" = field::Empty,
        "otel.name" = format!("HTTP {}", req.method()),
        "otel.kind" = "server",
        "client.address" = field::Empty,
        "url.path" = req.path(),
        "user_agent.original" = field::Empty,
        "http.request.method" = %req.method(),
        "http.response.status_code" = field::Empty,
        "otel.status_code" = DEFAULT_STATUS,
        "otel.status_description" = field::Empty,
    );

    if let Some(user_agent) = headers.get("user-agent").and_then(|h| h.to_str().ok()) {
        span.record("user_agent.original", user_agent);
    }

    let client_addr = client_addr(req.request());

    if let Some(ref ip) = client_addr {
        span.record("client.address", ip);
    }

    if let Some(status) = app_data.request_tracker.check_request(&client_addr).await {
        return Ok(req
            .into_response(HttpResponse::new(status))
            .map_into_right_body());
    }

    let start = Instant::now();
    let res = next.call(req).instrument(span.clone()).await?;

    let duration = Instant::now().duration_since(start).as_millis();
    let status = res.status();
    app_data
        .request_tracker
        .record_response(&client_addr, status);

    span.record("http.response.status_code", status.as_u16());
    span.record("duration", duration);

    if status.is_server_error() || status.is_client_error() {
        let message = if let Some(r) = status.canonical_reason() {
            format!("{} {}", status.as_str(), r)
        } else {
            status.as_str().to_owned()
        };
        record_error(&span, &message);
    } else if duration >= 250 {
        warn!(duration = duration, "Slow response");
    };

    Ok(res.map_into_left_body())
}
