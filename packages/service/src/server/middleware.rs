use std::{
    collections::HashMap,
    future::{ready, Ready},
    time::Instant,
};

use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error,
};
use futures::future::LocalBoxFuture;
use opentelemetry::global;
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

pub(crate) struct LoggingMiddleware<S> {
    service: S,
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
        let mut trace_headers = HashMap::new();
        let headers = req.request().headers();
        if let Some(Ok(value)) = headers.get("traceparent").map(|v| v.to_str()) {
            trace_headers.insert("traceparent".to_string(), value.to_owned());
        }
        if let Some(Ok(value)) = headers.get("tracestate").map(|v| v.to_str()) {
            trace_headers.insert("tracestate".to_string(), value.to_owned());
        }

        let parent_context =
            global::get_text_map_propagator(|propagator| propagator.extract(&trace_headers));

        let span = span!(
            Level::INFO,
            "api request",
            "duration" = field::Empty,
            "otel.name" = format!("{} {}", req.method(), req.path()),
            "otel.kind" = "server",
            "url.path" = req.path(),
            "http.request.method" = %req.method(),
            "http.response.status_code" = field::Empty,
            "otel.status_code" = DEFAULT_STATUS,
            "otel.status_description" = field::Empty,
        );
        span.set_parent(parent_context);

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
                    record_error(&span, status.as_str());
                } else if duration >= 250 {
                    warn!(duration = duration, "Slow response");
                };

                Ok(res)
            }
            .instrument(outer_span),
        )
    }
}
