use std::fmt;

use enum_dispatch::enum_dispatch;

use crate::Error;

#[enum_dispatch]
pub(crate) trait PathLike {
    fn path_parts(&self) -> Vec<&str>;
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
    pub(crate) fn try_from<'a, I: IntoIterator<Item = &'a str>>(v: I) -> Result<Self, Error> {
        let mut iter = v.into_iter();

        let catalog = if let Some(c) = iter.next() {
            c.to_owned()
        } else {
            return Err(Error::UnexpectedPath {
                path: "".to_string(),
            });
        };

        let item = if let Some(i) = iter.next() {
            i.to_owned()
        } else {
            return Ok(CatalogPath { catalog }.into());
        };

        let file = if let Some(f) = iter.next() {
            f.to_owned()
        } else {
            return Ok(MediaItemPath { catalog, item }.into());
        };

        let file_name = if let Some(f) = iter.next() {
            f.to_owned()
        } else {
            return Ok(MediaFilePath {
                catalog,
                item,
                file,
            }
            .into());
        };

        if let Some(trailing) = iter.next() {
            let mut rest = vec![trailing];
            rest.extend(iter);

            let path = format!("{catalog}/{item}/{file}/{file_name}/{}", rest.join("/"));
            Err(Error::UnexpectedPath { path })
        } else {
            Ok(FilePath {
                catalog,
                item,
                file,
                file_name,
            }
            .into())
        }
    }
}

impl fmt::Display for ResourcePath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.path_parts().join("/"))
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
        f.write_str(&self.path_parts().join("/"))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct MediaItemPath {
    pub(crate) catalog: String,
    pub(crate) item: String,
}

impl FilePath {
    pub fn catalog_path(&self) -> CatalogPath {
        CatalogPath {
            catalog: self.catalog.clone(),
        }
    }
}

impl PathLike for MediaItemPath {
    fn path_parts(&self) -> Vec<&str> {
        vec![&self.catalog, &self.item]
    }
}

impl fmt::Display for MediaItemPath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.path_parts().join("/"))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct MediaFilePath {
    pub(crate) catalog: String,
    pub(crate) item: String,
    pub(crate) file: String,
}

impl MediaFilePath {
    pub(crate) fn media_item(&self) -> MediaItemPath {
        MediaItemPath {
            catalog: self.catalog.clone(),
            item: self.item.clone(),
        }
    }

    pub(crate) fn file(&self, file_name: String) -> FilePath {
        FilePath {
            catalog: self.catalog.clone(),
            item: self.item.clone(),
            file: self.file.clone(),
            file_name,
        }
    }
}

impl FilePath {
    pub fn media_item_path(&self) -> MediaItemPath {
        MediaItemPath {
            catalog: self.catalog.clone(),
            item: self.item.clone(),
        }
    }
}

impl PathLike for MediaFilePath {
    fn path_parts(&self) -> Vec<&str> {
        vec![&self.catalog, &self.item, &self.file]
    }
}

impl fmt::Display for MediaFilePath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.path_parts().join("/"))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct FilePath {
    pub(crate) catalog: String,
    pub(crate) item: String,
    pub(crate) file: String,
    pub(crate) file_name: String,
}

impl FilePath {
    pub fn media_file_path(&self) -> MediaFilePath {
        MediaFilePath {
            catalog: self.catalog.clone(),
            item: self.item.clone(),
            file: self.file.clone(),
        }
    }
}

impl PathLike for FilePath {
    fn path_parts(&self) -> Vec<&str> {
        vec![&self.catalog, &self.item, &self.file, &self.file_name]
    }
}

impl fmt::Display for FilePath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.path_parts().join("/"))
    }
}

// #[derive(Debug, Clone)]
// pub struct CatalogTree {
//     pub(crate) path: CatalogPath,
//     pub(crate) items: HashMap<String, MediaItemTree>,
// }

// #[derive(Debug, Clone)]
// pub struct MediaItemTree {
//     pub(crate) path: MediaItemPath,
//     pub(crate) files: HashMap<String, MediaFileTree>,
// }

// #[derive(Debug, Clone)]
// pub struct MediaFileTree {
//     pub(crate) path: MediaFilePath,
//     pub(crate) files: HashMap<String, FilePath>,
// }
