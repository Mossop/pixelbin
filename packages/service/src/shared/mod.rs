//! Shared functionality for the Pixelbin server

pub(crate) mod config;
pub(crate) mod error;
pub(crate) mod mime;

use std::path::Path;

use config::Config;
use error::Result;
use nano_id::base62;

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
