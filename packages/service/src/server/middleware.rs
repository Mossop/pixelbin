use std::{
    future::{ready, Ready},
    net::SocketAddr,
    time::Instant,
};

use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    http::header::HeaderMap,
    Error, HttpRequest,
};
use futures::future::LocalBoxFuture;
use opentelemetry::{global, propagation::Extractor};
use tracing::{field, span, warn, Instrument, Level};
use tracing_opentelemetry::OpenTelemetrySpanExt;

use crate::shared::{record_error, DEFAULT_STATUS};

pub(crate) struct Logging;

impl<S, B> Transform<S, ServiceRequest> for Logging
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = LoggingMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(LoggingMiddleware { service }))
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

pub(crate) struct LoggingMiddleware<S> {
    service: S,
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

impl<S, B> Service<ServiceRequest> for LoggingMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let headers = req.request().headers();
        let extractor = TextMapExtractor {
            headers: req.request().headers(),
        };

        let parent_context =
            global::get_text_map_propagator(|propagator| propagator.extract(&extractor));

        let span = span!(
            Level::INFO,
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
        span.set_parent(parent_context);

        if let Some(user_agent) = headers.get("user-agent").and_then(|h| h.to_str().ok()) {
            span.record("user_agent.original", user_agent);
        }

        if let Some(ip) = client_addr(req.request()) {
            span.record("client.address", ip);
        }

        let start = Instant::now();

        let fut = self.service.call(req);

        let outer_span = span.clone();
        Box::pin(
            async move {
                let res = fut.await?;

                let duration = Instant::now().duration_since(start).as_millis();
                let status = res.status();

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
            .instrument(outer_span),
        )
    }
}
