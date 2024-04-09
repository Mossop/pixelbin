//! Shared functionality for the Pixelbin server

pub(crate) mod config;
pub(crate) mod error;
pub(crate) mod json;
pub(crate) mod mime;

use std::{io::ErrorKind, path::Path};

use config::Config;
use error::Result;
use nano_id::base62;
use tokio::fs::metadata;
use tracing::{Instrument, Span};

use crate::Error;

pub fn load_config(config_file: Option<&str>) -> Result<Config> {
    Config::load(config_file)
}

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
