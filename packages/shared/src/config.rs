use std::{env, fs, path::PathBuf, result, str::FromStr, time::Duration};

use figment::{
    providers::{Env, Format, Json},
    value::{
        magic::{Either, RelativePathBuf},
        Uncased, UncasedStr,
    },
    Figment,
};
use mime::Mime;
use serde::{Deserialize, Deserializer, Serialize};

use crate::{Error, Result};

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

fn duration_from_secs<'de, D>(deserializer: D) -> result::Result<Duration, D::Error>
where
    D: Deserializer<'de>,
{
    let secs = u64::deserialize(deserializer)?;

    Ok(Duration::from_secs(secs))
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RateLimit {
    #[serde(deserialize_with = "duration_from_secs")]
    pub duration: Duration,
    pub limit: u64,
    #[serde(deserialize_with = "duration_from_secs")]
    pub block_time: Duration,
    pub status: Option<u16>,
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

#[derive(Clone, Debug)]
pub struct Config {
    /// The hostname of the opentelemetry endpoint to use.
    pub telemetry_host: Option<String>,

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

    pub rate_limits: Vec<RateLimit>,

    /// Disables writing to remote stores for testing purposes.
    pub testing: bool,
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
    telemetry_host: Option<String>,
    storage: Option<Either<RelativePathBuf, StoragePaths>>,
    database_url: String,
    port: Option<u16>,
    api_url: Option<String>,
    thumbnails: Option<ThumbnailConfig>,
    rate_limits: Option<Vec<RateLimit>>,
    #[serde(default)]
    testing: bool,
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
            telemetry_host: parsed.telemetry_host,
            local_storage: resolve(local)?,
            temp_storage: resolve(temp)?,
            database_url: parsed.database_url,
            port: parsed.port,
            api_url: parsed.api_url,
            thumbnails: parsed.thumbnails.unwrap_or_default(),
            rate_limits: parsed.rate_limits.unwrap_or_else(|| {
                vec![
                    // A burst of 20 errors in 10 seconds blocks for a minute.
                    RateLimit {
                        duration: Duration::from_secs(10),
                        limit: 20,
                        block_time: Duration::from_secs(60),
                        status: None,
                    },
                    // An average of one error a second over a minute blocks for five minutes.
                    RateLimit {
                        duration: Duration::from_secs(60),
                        limit: 60,
                        block_time: Duration::from_secs(5 * 60),
                        status: None,
                    },
                    // Five bad logins over 10 seconds blocks for five minutes.
                    RateLimit {
                        duration: Duration::from_secs(10),
                        limit: 5,
                        block_time: Duration::from_secs(5 * 60),
                        status: Some(401),
                    },
                    // Ten bad logins over a minute blocks for thirty minutes.
                    RateLimit {
                        duration: Duration::from_secs(60),
                        limit: 10,
                        block_time: Duration::from_secs(30 * 60),
                        status: Some(401),
                    },
                ]
            }),
            testing: parsed.testing,
        })
    }
}
