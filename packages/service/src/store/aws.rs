use std::{fmt, str::from_utf8, time::Duration};

use aws_config::AppName;
use aws_sdk_s3::{
    config::{Credentials, Region},
    presigning::PresigningConfig,
    Client,
};
use futures::{future, TryStreamExt};

use super::{joinable, models::Storage, MediaFilePath};
use crate::{Error, Result};

pub(crate) struct AwsClient {
    client: Client,
    bucket: String,
    path: Option<String>,
    public_url: Option<String>,
}

impl AwsClient {
    pub(crate) async fn from_storage(storage: &Storage) -> Result<Self> {
        let mut config_loader = aws_config::from_env()
            .region(Region::new(storage.region.clone()))
            .app_name(AppName::new("pixelbin").unwrap())
            .credentials_provider(Credentials::new(
                &storage.access_key_id,
                &storage.secret_access_key,
                None,
                None,
                "pixelbin",
            ));

        if let Some(ref endpoint) = storage.endpoint {
            config_loader = config_loader.endpoint_url(endpoint.to_owned());
        }

        let config = config_loader.load().await;

        Ok(Self {
            client: Client::new(&config),
            bucket: storage.bucket.clone(),
            path: storage.path.clone(),
            public_url: storage.public_url.clone(),
        })
    }

    pub(crate) async fn file_uri(
        &self,
        path: &RemotePath,
        mimetype: &str,
        filename: Option<&str>,
    ) -> Result<String> {
        if let Some(ref public) = self.public_url {
            Ok(format!("{}/{}", joinable(public), path,))
        } else {
            let mut key = path.to_string();
            if let Some(ref prefix) = self.path {
                key = format!("{}/{}", joinable(prefix), key);
            }

            let disposition = if let Some(filename) = filename {
                format!("attachment; filename=\"{filename}\"")
            } else {
                "inline".to_string()
            };

            let presigned = self
                .client
                .get_object()
                .bucket(&self.bucket)
                .response_cache_control("max-age=1314000,immutable")
                .response_content_type(mimetype)
                .response_content_disposition(disposition)
                .key(key)
                .presigned(PresigningConfig::expires_in(Duration::from_secs(60 * 5)).unwrap())
                .await
                .map_err(|e| Error::S3Error {
                    message: e.to_string(),
                })?;

            Ok(presigned.uri().to_string())
        }
    }

    pub(crate) async fn list_files(
        &self,
        prefix: Option<RemotePath>,
    ) -> Result<Vec<(RemotePath, u64)>> {
        let mut request = self.client.list_objects_v2().bucket(&self.bucket);

        let base_path = if let Some(ref path) = self.path {
            RemotePath::from(path)
        } else {
            RemotePath::new()
        };

        let mut key_prefix = base_path.clone();
        if let Some(p) = prefix {
            key_prefix.push(p);
        }

        if !key_prefix.is_empty() {
            request = request.prefix(format!("{key_prefix}/"));
        }

        let stream = request.into_paginator().send();
        let files = stream
            .try_fold(Vec::<(RemotePath, u64)>::new(), |mut files, output| {
                if let Some(objects) = output.contents() {
                    files.extend(objects.iter().map(|o| {
                        (
                            RemotePath::from(o.key().unwrap())
                                .relative_to(&base_path)
                                .unwrap(),
                            o.size() as u64,
                        )
                    }));
                }

                future::ok(files)
            })
            .await
            .map_err(|e| Error::S3Error {
                message: format!("{e}"),
            })?;

        Ok(files)
    }
}

#[derive(Default, Clone, Debug, PartialEq, Eq, Hash)]
pub struct RemotePath {
    path: String,
}

impl RemotePath {
    pub fn new() -> Self {
        Default::default()
    }

    pub fn is_empty(&self) -> bool {
        self.path.is_empty()
    }

    pub fn push<S: AsRef<str>>(&mut self, s: S) {
        let str = s.as_ref();

        match (self.path.is_empty(), str.is_empty()) {
            (false, false) => self.path = format!("{}/{}", self.path, str),
            (true, false) => self.path = str.to_owned(),
            _ => {}
        };
    }

    pub fn join<S: AsRef<str>>(&self, s: S) -> Self {
        let str = s.as_ref();

        let path = match (self.path.is_empty(), str.is_empty()) {
            (false, false) => format!("{}/{}", self.path, str),
            (true, false) => str.to_owned(),
            _ => self.path.clone(),
        };

        Self { path }
    }

    pub fn relative_to<S: AsRef<str>>(&self, base: S) -> Option<Self> {
        let st_base = format!("{}/", joinable(base.as_ref()));

        if st_base.len() == 1 {
            Some(self.clone())
        } else if self.path.starts_with(&st_base) {
            Some(Self {
                path: from_utf8(&self.path.as_bytes()[st_base.len()..])
                    .unwrap()
                    .to_owned(),
            })
        } else {
            None
        }
    }
}

impl fmt::Display for RemotePath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.path)
    }
}

impl AsRef<str> for RemotePath {
    fn as_ref(&self) -> &str {
        &self.path
    }
}

impl From<RemotePath> for String {
    fn from(path: RemotePath) -> String {
        path.to_string()
    }
}

impl From<&str> for RemotePath {
    fn from(st: &str) -> RemotePath {
        RemotePath {
            path: st.to_owned(),
        }
    }
}

impl From<&String> for RemotePath {
    fn from(st: &String) -> RemotePath {
        RemotePath {
            path: st.to_owned(),
        }
    }
}

impl From<String> for RemotePath {
    fn from(st: String) -> RemotePath {
        RemotePath { path: st }
    }
}

impl From<&MediaFilePath> for RemotePath {
    fn from(mp: &MediaFilePath) -> RemotePath {
        mp.remote_path()
    }
}

impl From<MediaFilePath> for RemotePath {
    fn from(mp: MediaFilePath) -> RemotePath {
        mp.remote_path()
    }
}
