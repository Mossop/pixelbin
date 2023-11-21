use std::time::Duration;

use async_trait::async_trait;
use aws_config::AppName;
use aws_sdk_s3::{
    config::{Credentials, Region},
    presigning::PresigningConfig,
    Client,
};
use futures::{future, TryStreamExt};
use tracing::info;

use super::{
    models::Storage,
    path::{FilePath, PathLike, ResourcePath},
};
use crate::{Error, FileStore, Result};

pub(crate) fn joinable(st: &str) -> &str {
    st.trim_matches('/')
}

fn remote_path<P: PathLike>(path: &P) -> String {
    path.path_parts().join("/")
}

pub(crate) struct AwsClient {
    client: Client,
    bucket: String,
    path: Option<String>,
    public_url: Option<String>,
}

impl AwsClient {
    fn strip_prefix<'a>(&self, remote: &'a str) -> &'a str {
        if let Some(path) = &self.path {
            remote.trim_start_matches(path).trim_start_matches('/')
        } else {
            remote
        }
    }

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
        path: &FilePath,
        mimetype: &str,
        filename: Option<&str>,
    ) -> Result<String> {
        if let Some(ref public) = self.public_url {
            Ok(format!("{}/{}", joinable(public), remote_path(path),))
        } else {
            let mut key = remote_path(path);
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
}

#[async_trait]
impl FileStore for AwsClient {
    async fn list_files(&self, prefix: Option<&ResourcePath>) -> Result<Vec<(ResourcePath, u64)>> {
        let mut request = self.client.list_objects_v2().bucket(&self.bucket);

        match (&self.path, prefix) {
            (Some(path), Some(prefix)) => {
                request = request.prefix(format!("{path}/{}/", remote_path(prefix)))
            }
            (Some(path), None) => request = request.prefix(format!("{path}/")),
            (None, Some(prefix)) => request = request.prefix(format!("{}/", remote_path(prefix))),
            _ => {}
        }

        let stream = request.into_paginator().send();
        let files = stream
            .try_fold(Vec::<(ResourcePath, u64)>::new(), |mut files, output| {
                if let Some(objects) = output.contents() {
                    files.extend(objects.iter().map(|o| {
                        (
                            ResourcePath::try_from(self.strip_prefix(o.key().unwrap()).split('/'))
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

    async fn delete(&self, path: &ResourcePath) -> Result {
        info!(path=%path, "Refusing to delete remote file");

        Ok(())
    }
}
