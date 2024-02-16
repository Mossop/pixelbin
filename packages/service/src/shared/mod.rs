//! Shared functionality for the Pixelbin server

pub(crate) mod config;
pub(crate) mod error;
pub(crate) mod mime;

use std::path::Path;

use config::Config;
use error::Result;
use nano_id::base62;
use tracing::{Instrument, Span};

pub fn load_config(config_file: Option<&Path>) -> Result<Config> {
    if let Some(path) = config_file {
        Config::load(path)
    } else {
        let path = std::env::current_dir()?;
        Config::load(&path.join("pixelbin.json"))
    }
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
