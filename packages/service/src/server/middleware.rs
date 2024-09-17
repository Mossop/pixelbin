use std::{collections::HashMap, net::SocketAddr, result, sync::Arc, time::Instant};

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
use tracing::{error, field, instrument, span, warn, Instrument, Level, Span};
use tracing_opentelemetry::OpenTelemetrySpanExt;

use crate::{
    server::AppState,
    shared::{record_error, DEFAULT_STATUS},
    Result, Store,
};

#[derive(Clone, Copy)]
struct BlockState {
    status: StatusCode,
    expiry: DateTime<Utc>,
}

#[derive(Clone)]
pub(super) struct RequestTracker {
    store: Store,
    block_list: Arc<RwLock<HashMap<String, BlockState>>>,
}

impl RequestTracker {
    pub(super) fn new(store: Store) -> Self {
        Self {
            store,
            block_list: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    async fn current_block_state(&self, client_addr: &str) -> Option<BlockState> {
        let block_list = self.block_list.read().await;
        block_list.get(client_addr).copied()
    }

    async fn check_request(&self, client_addr: &Option<String>) -> Option<StatusCode> {
        if let Some(client) = client_addr {
            if let Some(state) = self.current_block_state(client).await {
                if state.expiry > Utc::now() {
                    return Some(state.status);
                }
            }
        }

        None
    }

    async fn record_block_status(self, _client_addr: String, _status: StatusCode) -> Result {
        let _conn = self.store.connect().await?;

        // Update database and calculate new block status

        // Get current block status and compare

        // If necessary write new block status

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
