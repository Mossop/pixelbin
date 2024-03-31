use std::{env, fs, path::PathBuf, str::FromStr};

use figment::{
    providers::{Env, Format, Json},
    value::{
        magic::{Either, RelativePathBuf},
        Uncased, UncasedStr,
    },
    Figment,
};
use mime::Mime;
use serde::{Deserialize, Serialize};

use crate::{store::DiskStore, Error, Result};

mod mimes {
    use std::str::FromStr;

    use mime::Mime;
    use serde::{
        de::{Error, Unexpected},
        Deserialize, Deserializer, Serialize, Serializer,
    };

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

#[derive(Clone, Debug, Default)]
pub struct Config {
    /// The url of the opentelemetry endpoint to use.
    pub telemetry_url: Option<String>,

    /// The location of locally stored alternate files.
    pub local_storage: PathBuf,

    /// The location of temporary files.
    pub temp_storage: PathBuf,

    /// The database connection url.
    pub database_url: String,

    /// The port to run the webserver on.
    pub port: Option<u16>,

    /// The canonical API host url.
    pub api_url: Option<String>,

    pub thumbnails: ThumbnailConfig,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoragePaths {
    local: RelativePathBuf,
    temp: RelativePathBuf,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ParsedConfig {
    telemetry_url: Option<String>,
    storage: Option<Either<RelativePathBuf, StoragePaths>>,
    database_url: String,
    port: Option<u16>,
    api_url: Option<String>,
    thumbnails: Option<ThumbnailConfig>,
}

fn resolve(mut path: PathBuf) -> Result<PathBuf> {
    if !path.is_absolute() {
        path = env::current_dir().unwrap().join(&path);
    }

    fs::create_dir_all(&path).map_err(|e| Error::ConfigError {
        message: format!("Failed to create directory '{}': {}", path.display(), e),
    })?;

    path = path.canonicalize().map_err(|e| Error::ConfigError {
        message: format!("Failed to resolve directory '{}': {}", path.display(), e),
    })?;

    Ok(path)
}

fn map_env(key: &UncasedStr) -> Uncased<'_> {
    key.as_str()
        .split('_')
        .enumerate()
        .fold(String::new(), |mut key, (idx, part)| {
            if idx == 0 {
                key.push_str(&part.to_lowercase());
            } else {
                key.push_str(&part[0..1].to_uppercase());
                key.push_str(&part[1..].to_lowercase());
            }

            key
        })
        .into()
}

impl Config {
    pub fn load(config_file: Option<&str>) -> Result<Self> {
        let file_provider = if let Some(path) = config_file {
            Json::file_exact(path)
        } else {
            Json::file("pixelbin.json")
        };

        let parsed: ParsedConfig = Figment::new()
            .join(Env::prefixed("PIXELBIN_").map(map_env).lowercase(false))
            .join(file_provider)
            .extract()?;

        let (local, temp) = match parsed.storage {
            Some(Either::Left(storage)) => {
                let storage_path = resolve(storage.relative())?;
                (storage_path.join("local"), storage_path.join("temp"))
            }
            Some(Either::Right(paths)) => (
                resolve(paths.local.relative())?,
                resolve(paths.temp.relative())?,
            ),
            None => {
                let storage_path = env::current_dir().unwrap();
                (storage_path.join("local"), storage_path.join("temp"))
            }
        };

        Ok(Config {
            telemetry_url: parsed.telemetry_url,
            local_storage: resolve(local)?,
            temp_storage: resolve(temp)?,
            database_url: parsed.database_url,
            port: parsed.port,
            api_url: parsed.api_url,
            thumbnails: parsed.thumbnails.unwrap_or_default(),
        })
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
