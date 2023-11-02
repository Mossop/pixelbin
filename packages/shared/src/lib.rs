#![deny(unreachable_pub)]
//! Shared functionality for the Pixelbin server

mod config;
mod error;
pub mod serde;

use std::path::Path;

pub use config::{Config, ThumbnailConfig};
pub use error::{Error, Result};

pub fn load_config(config_file: Option<&Path>) -> Result<Config> {
    if let Some(path) = config_file {
        Config::load(path)
    } else {
        let path = std::env::current_dir()?;
        Config::load(&path.join("pixelbin.json"))
    }
}
