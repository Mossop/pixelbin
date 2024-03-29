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
use tracing::{event, field, span, Instrument, Level};
use tracing_opentelemetry::OpenTelemetrySpanExt;

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
            "otel.name" = format!("{} {}", req.method(), req.path()),
            "otel.kind" = "server",
            "url.path" = req.path(),
            "http.request.method" = %req.method(),
            "http.response.status_code" = field::Empty,
            "otel.status_code" = field::Empty,
        )
        .entered();
        span.set_parent(parent_context);

        let start = Instant::now();

        let fut = self.service.call(req);

        Box::pin(async move {
            let res = fut.in_current_span().await?;

            let duration = Instant::now().duration_since(start).as_millis();
            let status = res.status();

            span.record("http.response.status_code", status.as_u16());

            if status.is_server_error() {
                event!(
                    Level::ERROR,
                    duration = duration,
                    status = status.as_str(),
                    "Server error"
                );
                span.record("otel.status_code", "Error");
            } else if status.is_client_error() {
                event!(
                    Level::WARN,
                    duration = duration,
                    status = status.as_str(),
                    "Client error"
                );
                span.record("otel.status_code", "Error");
            } else if duration >= 250 {
                event!(Level::WARN, duration = duration, "Slow response");
                span.record("otel.status_code", "Ok");
            } else {
                event!(Level::TRACE, duration = duration, status = status.as_str());
                span.record("otel.status_code", "Ok");
            };

            Ok(res)
        })
    }
}
