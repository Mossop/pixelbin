use std::{
    future::{ready, Ready},
    time::Instant,
};

use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error,
};
use futures::future::LocalBoxFuture;
use tracing::{event, field, span, Level};

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
        let span = span!(
            Level::INFO,
            "api request",
            "otel.name" = format!("{} {}", req.method(), req.path()),
            "otel.kind" = "Server",
            "url.path" = req.path(),
            "http.request.method" = %req.method(),
            "http.response.status_code" = field::Empty,
            "otel.status_code" = field::Empty,
        )
        .entered();
        let start = Instant::now();

        let fut = self.service.call(req);

        Box::pin(async move {
            let res = fut.await?;

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
            } else {
                event!(Level::TRACE, duration = duration, status = status.as_str());
            };

            span.exit();

            Ok(res)
        })
    }
}
