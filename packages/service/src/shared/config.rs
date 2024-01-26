use std::{
    env,
    fs::{self, File},
    path::{Path, PathBuf},
    str::FromStr,
};

use mime::Mime;
use serde::{Deserialize, Serialize};

use crate::{store::DiskStore, Error, Result};

mod mimes {
    use std::str::FromStr;

    use mime::Mime;
    use serde::{de::Error, de::Unexpected, Deserialize, Deserializer, Serialize, Serializer};

    pub(crate) fn serialize<S>(mimes: &[Mime], serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        mimes
            .iter()
            .map(AsRef::as_ref)
            .collect::<Vec<&str>>()
            .serialize(serializer)
    }

    pub(crate) fn deserialize<'de, D>(deserializer: D) -> Result<Vec<Mime>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let list = Vec::<&str>::deserialize(deserializer)?;

        list.into_iter()
            .try_fold(Vec::<Mime>::new(), |mut list, st| {
                let mime = Mime::from_str(st).map_err(|_| {
                    D::Error::invalid_value(Unexpected::Str(st), &"a valid mime type")
                })?;
                list.push(mime);
                Ok(list)
            })
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailConfig {
    #[serde(with = "mimes")]
    pub alternate_types: Vec<Mime>,
    pub sizes: Vec<u32>,
}

impl Default for ThumbnailConfig {
    fn default() -> Self {
        ThumbnailConfig {
            alternate_types: vec![Mime::from_str("image/webp").unwrap()],
            sizes: vec![150, 200, 250, 300, 350, 400, 450, 500],
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(default)]
    storage: PathBuf,

    pub telemetry: Option<String>,

    #[serde(default)]
    /// The location of locally stored alternate files.
    pub local_storage: PathBuf,
    /// The location of temporary files.
    #[serde(default)]
    pub temp_storage: PathBuf,

    /// The database connection url.
    pub database_url: String,

    /// The port to run the webserver on.
    pub port: Option<u16>,

    /// The canonical API host url.
    pub api_url: Option<String>,

    #[serde(default)]
    pub thumbnails: ThumbnailConfig,
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
        tracing::debug!("Loading config from {}", config_file.display());
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

    pub(crate) fn local_store(&self) -> DiskStore {
        DiskStore {
            root: self.local_storage.clone(),
        }
    }

    pub(crate) fn temp_store(&self) -> DiskStore {
        DiskStore {
            root: self.temp_storage.clone(),
        }
    }
}
