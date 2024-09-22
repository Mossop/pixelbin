use std::{
    fmt,
    io::ErrorKind,
    iter::once,
    path::{Path, PathBuf},
};

use async_trait::async_trait;
use mime::Mime;
use pixelbin_shared::{Config, Ignorable};
use tempfile::TempPath;
use tokio::fs;
use tracing::{debug, instrument};

use crate::{
    store::path::{FilePath, PathLike, ResourceList, ResourcePath},
    Result,
};

#[async_trait]
pub trait FileStore {
    async fn list_files<P>(&self, prefix: Option<&P>) -> Result<ResourceList>
    where
        P: PathLike + Send + Sync + fmt::Debug;

    async fn exists(&self, path: &FilePath) -> Result<bool>;

    async fn prune<P>(&self, path: &P) -> Result
    where
        P: PathLike + Send + Sync + fmt::Debug;

    async fn delete<P>(&self, path: &P) -> Result
    where
        P: PathLike + Send + Sync + fmt::Debug;

    async fn pull(&self, path: &FilePath, target: &Path) -> Result;

    async fn push(&self, source: &Path, path: &FilePath, mimetype: &Mime) -> Result;
}

pub(crate) struct DiskStore {
    pub(crate) root: PathBuf,
    testing: bool,
}

impl DiskStore {
    pub(crate) fn local_store(config: &Config) -> Self {
        Self {
            root: config.local_storage.clone(),
            testing: config.testing,
        }
    }

    pub(crate) fn temp_store(config: &Config) -> Self {
        Self {
            root: config.temp_storage.clone(),
            testing: config.testing,
        }
    }

    pub(crate) fn local_path<P: PathLike>(&self, path: &P) -> PathBuf {
        let mut local_path = self.root.clone();
        for part in path.path_parts() {
            local_path.push(part);
        }

        local_path
    }

    #[instrument(level = "trace", skip(self, temp_file), err)]
    pub(crate) async fn copy_from_temp(&self, temp_file: TempPath, path: &FilePath) -> Result {
        if self.testing {
            debug!("Not pushing in testing mode.");
            return Ok(());
        }

        let target = self.local_path(path);

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).await?;
        }

        let source = temp_file.to_path_buf();

        if fs::hard_link(&source, &target).await.is_err() {
            fs::copy(&source, &target)
                .await
                .map_err(|e| crate::Error::Unknown {
                    message: e.to_string(),
                })?;
        }

        Ok(())
    }

    async fn prune_path(path: &Path, is_testing: bool) -> Result<bool> {
        let mut reader = match fs::read_dir(path).await {
            Ok(r) => r,
            Err(e) => {
                if e.kind() == ErrorKind::NotFound {
                    return Ok(true);
                } else {
                    return Err(e.into());
                }
            }
        };
        let mut can_prune = true;

        while let Some(entry) = reader.next_entry().await? {
            let stats = entry.metadata().await?;
            if stats.is_dir() {
                if !Box::pin(Self::prune_path(&entry.path(), is_testing)).await? {
                    can_prune = false;
                }
            } else {
                can_prune = false;
            }
        }

        if can_prune {
            if is_testing {
                debug!(path=%path.display(), "Not pruning in testing mode.");
                can_prune = false;
            } else {
                fs::remove_dir(path).await.ignore();
            }
        }

        Ok(can_prune)
    }
}

#[async_trait]
impl FileStore for DiskStore {
    async fn exists(&self, path: &FilePath) -> Result<bool> {
        Ok(fs::try_exists(self.local_path(path)).await?)
    }

    #[allow(clippy::blocks_in_conditions)]
    #[instrument(skip(self), err)]
    async fn list_files<P>(&self, prefix: Option<&P>) -> Result<ResourceList>
    where
        P: PathLike + Send + Sync + fmt::Debug,
    {
        let mut files = ResourceList::new();

        let root = if let Some(prefix) = prefix {
            self.local_path(prefix)
        } else {
            self.root.clone()
        };

        match fs::metadata(&root).await {
            Ok(metadata) => {
                if metadata.is_file() {
                    if let Some(prefix) = prefix {
                        if let Ok(path) = ResourcePath::try_from(prefix.path_parts()) {
                            files.insert(path, metadata.len());
                        }
                    }
                    return Ok(files);
                }
            }
            Err(err) => {
                if err.kind() == ErrorKind::NotFound {
                    return Ok(files);
                }
                return Err(err.into());
            }
        }

        let mut path_parts: Vec<String> = root
            .strip_prefix(&self.root)
            .unwrap()
            .components()
            .map(|c| c.as_os_str().to_str().unwrap().to_owned())
            .collect();

        let mut readers = vec![fs::read_dir(root).await?];
        while !readers.is_empty() {
            let reader = readers.last_mut().unwrap();
            match reader.next_entry().await? {
                Some(entry) => {
                    let name = if let Ok(name) = entry.file_name().into_string() {
                        name
                    } else {
                        continue;
                    };

                    let stats = entry.metadata().await?;
                    if stats.is_dir() {
                        readers.push(fs::read_dir(entry.path()).await?);
                        path_parts.push(name);
                    } else if stats.is_file() {
                        let all_parts = path_parts
                            .iter()
                            .map(|s| s.as_str())
                            .chain(once(name.as_str()));

                        if let Ok(path) = ResourcePath::try_from(all_parts) {
                            files.insert(path, stats.len());
                        }
                    }
                }
                None => {
                    readers.pop();
                    path_parts.pop();
                }
            }
        }

        Ok(files)
    }

    #[allow(clippy::blocks_in_conditions)]
    #[instrument(skip(self), err)]
    async fn prune<P>(&self, path: &P) -> Result
    where
        P: PathLike + Send + Sync + fmt::Debug,
    {
        let local_path = self.local_path(path);

        if Self::prune_path(&local_path, self.testing).await? {
            let mut current = local_path.as_path();

            while let Some(parent) = current.parent() {
                if parent == self.root {
                    break;
                }

                if let Ok(mut reader) = fs::read_dir(parent).await {
                    match reader.next_entry().await {
                        Ok(None) => {
                            if fs::remove_dir(parent).await.is_err() {
                                break;
                            }
                        }
                        _ => break,
                    }
                } else {
                    break;
                }

                current = parent;
            }
        }

        Ok(())
    }

    #[allow(clippy::blocks_in_conditions)]
    #[instrument(skip(self), err)]
    async fn delete<P>(&self, path: &P) -> Result
    where
        P: PathLike + Send + Sync + fmt::Debug,
    {
        if self.testing {
            debug!("Not deleting in testing mode.");
            return Ok(());
        }

        let local = self.local_path(path);

        let stats = match fs::metadata(&local).await {
            Ok(s) => s,
            Err(e) => {
                if e.kind() == ErrorKind::NotFound {
                    return Ok(());
                }

                return Err(e.into());
            }
        };

        if stats.is_dir() {
            fs::remove_dir_all(&local).await?;
        } else {
            fs::remove_file(&local).await?;
        }

        Ok(())
    }

    #[allow(clippy::blocks_in_conditions)]
    #[instrument(skip(self), err)]
    async fn pull(&self, path: &FilePath, target: &Path) -> Result {
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).await?;
        }

        let local = self.local_path(path);

        fs::copy(local, target).await?;

        Ok(())
    }

    #[allow(clippy::blocks_in_conditions)]
    #[instrument(skip(self), err)]
    async fn push(&self, source: &Path, path: &FilePath, _mimetype: &Mime) -> Result {
        if self.testing {
            debug!("Not pushing in testing mode.");
            return Ok(());
        }

        let target = self.local_path(path);

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).await?;
        }

        fs::copy(source, target).await?;

        Ok(())
    }
}
