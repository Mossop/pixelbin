use std::{fmt, path::PathBuf};

use enum_dispatch::enum_dispatch;

use crate::Error;

#[enum_dispatch]
pub(crate) trait PathLike {
    fn path_parts(&self) -> Vec<&str>;

    fn local_path(&self) -> PathBuf {
        let mut path = PathBuf::new();
        for part in self.path_parts() {
            path.push(part);
        }

        path
    }

    fn remote_path(&self) -> String {
        self.path_parts().join("/")
    }
}

#[enum_dispatch(PathLike)]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ResourcePath {
    Catalog(CatalogPath),
    MediaItem(MediaItemPath),
    MediaFile(MediaFilePath),
    File(FilePath),
}

impl ResourcePath {
    pub(crate) fn from_remote(remote: &str) -> Result<Self, Error> {
        let parts: Vec<&str> = remote.split('/').collect();

        let resource = match parts.len() {
            1 => CatalogPath {
                catalog: parts[0].to_owned(),
            }
            .into(),
            2 => MediaItemPath {
                catalog: parts[0].to_owned(),
                item: parts[1].to_owned(),
            }
            .into(),
            3 => MediaFilePath {
                catalog: parts[0].to_owned(),
                item: parts[1].to_owned(),
                file: parts[2].to_owned(),
            }
            .into(),
            4 => FilePath {
                catalog: parts[0].to_owned(),
                item: parts[1].to_owned(),
                file: parts[2].to_owned(),
                file_name: parts[3].to_owned(),
            }
            .into(),
            _ => {
                return Err(Error::UnexpectedPath {
                    path: remote.to_owned(),
                })
            }
        };

        Ok(resource)
    }
}

impl fmt::Display for ResourcePath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.remote_path())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CatalogPath {
    pub(crate) catalog: String,
}

impl PathLike for CatalogPath {
    fn path_parts(&self) -> Vec<&str> {
        vec![&self.catalog]
    }
}

impl fmt::Display for CatalogPath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.remote_path())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct MediaItemPath {
    pub(crate) catalog: String,
    pub(crate) item: String,
}

impl PathLike for MediaItemPath {
    fn path_parts(&self) -> Vec<&str> {
        vec![&self.catalog, &self.item]
    }
}

impl fmt::Display for MediaItemPath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.remote_path())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct MediaFilePath {
    pub(crate) catalog: String,
    pub(crate) item: String,
    pub(crate) file: String,
}

impl PathLike for MediaFilePath {
    fn path_parts(&self) -> Vec<&str> {
        vec![&self.catalog, &self.item, &self.file]
    }
}

impl fmt::Display for MediaFilePath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.remote_path())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct FilePath {
    pub(crate) catalog: String,
    pub(crate) item: String,
    pub(crate) file: String,
    pub(crate) file_name: String,
}

impl PathLike for FilePath {
    fn path_parts(&self) -> Vec<&str> {
        vec![&self.catalog, &self.item, &self.file, &self.file_name]
    }
}

impl fmt::Display for FilePath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.remote_path())
    }
}
