//! Shared functionality for the Pixelbin server
pub(crate) mod json;
pub(crate) mod mime;

use std::{io::ErrorKind, path::Path};

use nano_id::base62;
use tokio::fs::metadata;
use tracing::{error, Instrument, Span};

use crate::{Error, Result};

pub(crate) const DEFAULT_STATUS: &str = "Ok";

pub(crate) fn long_id(prefix: &str) -> String {
    format!("{prefix}:{}", base62::<25>())
}

pub(crate) fn short_id(prefix: &str) -> String {
    format!("{prefix}:{}", base62::<10>())
}

pub(crate) async fn spawn_blocking<F, R>(span: Span, f: F) -> R
where
    F: FnOnce() -> R + Send + 'static,
    R: Send + 'static,
{
    tokio::task::spawn_blocking(move || span.in_scope(f))
        .in_current_span()
        .await
        .unwrap()
}

pub(crate) async fn file_exists(path: &Path) -> Result<bool> {
    match metadata(path).await {
        Ok(m) => {
            if !m.is_file() {
                return Err(Error::UnexpectedPath {
                    path: path.display().to_string(),
                });
            }

            Ok(true)
        }
        Err(e) => {
            if e.kind() != ErrorKind::NotFound {
                return Err(Error::from(e));
            }

            Ok(false)
        }
    }
}

pub(crate) fn record_result<T>(span: &Span, result: &Result<T>) {
    match result {
        Ok(_) => {
            span.record("otel.status_code", DEFAULT_STATUS);
        }
        Err(e) => {
            record_error(span, &e.to_string());
        }
    }
}

pub(crate) fn record_error(span: &Span, error: &str) {
    span.record("otel.status_code", "Error");
    span.record("otel.status_description", error);
    error!(parent: span, "{}", error);
}
