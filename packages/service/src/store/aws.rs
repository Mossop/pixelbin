use std::{path::Path, time::Duration};

use async_trait::async_trait;
use aws_config::{AppName, BehaviorVersion};
use aws_sdk_s3::{
    config::{Credentials, Region},
    presigning::PresigningConfig,
    primitives::ByteStream,
    Client,
};
use mime::Mime;
use tokio::{fs, io};
use tracing::trace;

use crate::{
    store::{
        models::Storage,
        path::{FilePath, PathLike, ResourcePath},
    },
    Error, FileStore, Result,
};

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
        let mut config_loader = aws_config::defaults(BehaviorVersion::latest())
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
        mimetype: &Mime,
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
                .response_content_type(mimetype.as_ref())
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

        request = match (&self.path, prefix) {
            (Some(path), Some(prefix)) => {
                request.prefix(format!("{path}/{}/", remote_path(prefix)))
            }
            (Some(path), None) => request.prefix(format!("{path}/")),
            (None, Some(prefix)) => request.prefix(format!("{}/", remote_path(prefix))),
            _ => request,
        };

        let stream = request.into_paginator().send();
        let files = stream
            .try_collect()
            .await
            .map_err(|e| Error::S3Error {
                message: format!("Failed to list files: {e}"),
            })?
            .into_iter()
            .fold(Vec::<(ResourcePath, u64)>::new(), |mut files, output| {
                files.extend(output.contents().iter().map(|o| {
                    (
                        ResourcePath::try_from(self.strip_prefix(o.key().unwrap()).split('/'))
                            .unwrap(),
                        o.size().unwrap() as u64,
                    )
                }));

                files
            });

        Ok(files)
    }

    async fn delete(&self, path: &ResourcePath) -> Result {
        trace!(path=%path, "Skipping deletion");
        Ok(())
    }

    async fn pull(&self, path: &FilePath, target: &Path) -> Result {
        trace!(path=%path, "Downloading object");

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).await?;
        }

        let key = match &self.path {
            Some(p) => format!("{p}/{}", remote_path(path)),
            None => remote_path(path),
        };

        let mut file = fs::File::create(target).await?;

        let response = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await
            .map_err(|e| Error::S3Error {
                message: format!("Failed to get object: {e}"),
            })?;

        let mut reader = response.body.into_async_read();

        io::copy(&mut reader, &mut file).await?;

        Ok(())
    }

    async fn push(&self, source: &Path, path: &FilePath, mimetype: &Mime) -> Result {
        let key = match &self.path {
            Some(p) => format!("{p}/{}", remote_path(path)),
            None => remote_path(path),
        };

        let body = ByteStream::from_path(source)
            .await
            .map_err(|e| Error::S3Error {
                message: format!("Failed to read file: {e}"),
            })?;

        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .cache_control("max-age=1314000, immutable")
            .content_type(mimetype.as_ref())
            .body(body)
            .send()
            .await
            .map_err(|e| Error::S3Error {
                message: format!("Failed to put object: {e}"),
            })?;

        Ok(())
    }
}
