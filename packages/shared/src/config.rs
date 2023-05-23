use std::{
    env,
    fs::{self, File},
    path::{Path, PathBuf},
};

use serde::Deserialize;

use crate::{Error, Result};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(default)]
    storage: PathBuf,

    #[serde(default)]
    /// The location of locally stored alternate files.
    pub local_storage: PathBuf,
    /// The location of temporary files.
    #[serde(default)]
    pub temp_storage: PathBuf,

    /// The database connection url.
    pub database_url: String,
}

fn resolve(root: &Path, path: &mut PathBuf) -> Result {
    if !path.is_absolute() {
        *path = root.join(&path);
    }

    fs::create_dir_all(&path).map_err(|e| Error::ConfigError {
        message: format!("Failed to create directory '{}': {}", path.display(), e),
    })?;

    *path = path.canonicalize().map_err(|e| Error::ConfigError {
        message: format!("Failed to resolve directory '{}': {}", path.display(), e),
    })?;

    Ok(())
}

impl Config {
    pub fn load(config_file: &Path) -> Result<Self> {
        tracing::trace!("Loading config from {}", config_file.display());
        let root = env::current_dir()
            .unwrap()
            .join(config_file.parent().unwrap());

        let reader = File::open(config_file).map_err(|e| Error::ConfigError {
            message: format!(
                "Failed to open config file '{}': {}",
                config_file.display(),
                e
            ),
        })?;

        let mut config: Config =
            serde_json::from_reader(reader).map_err(|e| Error::ConfigError {
                message: format!(
                    "Failed to parse config file '{}': {}",
                    config_file.display(),
                    e
                ),
            })?;

        if config.storage.as_os_str().is_empty() {
            config.storage = root.clone();
        }
        resolve(&root, &mut config.storage)?;

        if config.local_storage.as_os_str().is_empty() {
            config.local_storage = config.storage.join("local");
        }
        resolve(&root, &mut config.local_storage)?;

        if config.temp_storage.as_os_str().is_empty() {
            config.temp_storage = config.storage.join("temp");
        }
        resolve(&root, &mut config.temp_storage)?;

        Ok(config)
    }
}
