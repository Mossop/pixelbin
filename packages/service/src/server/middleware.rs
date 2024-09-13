use std::{net::SocketAddr, time::Instant};

use actix_web::{
    body::MessageBody,
    dev::{ServiceRequest, ServiceResponse},
    http::{header::HeaderMap, StatusCode},
    middleware::Next,
    web::Data,
    Error, FromRequest, HttpRequest,
};
use opentelemetry::{global, propagation::Extractor};
use tracing::{field, instrument, span, warn, Instrument, Level, Span};
use tracing_opentelemetry::OpenTelemetrySpanExt;

use crate::{
    server::AppState,
    shared::{record_error, DEFAULT_STATUS},
};

pub(super) struct RequestTracker {}

impl RequestTracker {
    pub(super) fn new() -> Self {
        Self {}
    }

    fn check_request(&self, client_addr: &Option<String>) -> bool {
        true
    }

    fn record_response(&self, client_addr: &Option<String>, status: StatusCode) {
        if let Some(client) = client_addr {}
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
pub(super) async fn middleware(
    req: ServiceRequest,
    next: Next<impl MessageBody>,
) -> Result<ServiceResponse<impl MessageBody>, Error> {
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

    if !app_data.request_tracker.check_request(&client_addr) {
        // TODO
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

    Ok(res)
}
