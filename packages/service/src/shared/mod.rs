//! Shared functionality for the Pixelbin server

pub(crate) mod config;
pub(crate) mod error;

use std::path::Path;

use config::Config;
use error::Result;

pub fn load_config(config_file: Option<&Path>) -> Result<Config> {
    if let Some(path) = config_file {
        Config::load(path)
    } else {
        let path = std::env::current_dir()?;
        Config::load(&path.join("pixelbin.json"))
    }
}
