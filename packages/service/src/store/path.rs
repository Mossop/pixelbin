use std::{collections::HashMap, fmt};

use enum_dispatch::enum_dispatch;

use crate::Error;

#[enum_dispatch]
pub trait PathLike {
    fn is_file(&self) -> bool {
        false
    }

    fn path_parts(&self) -> Vec<&str>;
}

#[enum_dispatch(PathLike)]
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ResourcePath {
    CatalogStore(CatalogStore),
    MediaItemStore(MediaItemStore),
    MediaFileStore(MediaFileStore),
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
            return Ok(CatalogStore { catalog }.into());
        };

        let file = if let Some(f) = iter.next() {
            f.to_owned()
        } else {
            return Ok(MediaItemStore { catalog, item }.into());
        };

        let file_name = if let Some(f) = iter.next() {
            f.to_owned()
        } else {
            return Ok(MediaFileStore {
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
pub struct CatalogStore {
    pub(crate) catalog: String,
}

impl PathLike for CatalogStore {
    fn path_parts(&self) -> Vec<&str> {
        vec![&self.catalog]
    }
}

impl fmt::Display for CatalogStore {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.path_parts().join("/"))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct MediaItemStore {
    pub(crate) catalog: String,
    pub(crate) item: String,
}

impl MediaItemStore {
    pub(crate) fn media_file_store(&self, media_file: &str) -> MediaFileStore {
        MediaFileStore {
            catalog: self.catalog.clone(),
            item: self.item.clone(),
            file: media_file.to_owned(),
        }
    }
}

impl PathLike for MediaItemStore {
    fn path_parts(&self) -> Vec<&str> {
        vec![&self.catalog, &self.item]
    }
}

impl fmt::Display for MediaItemStore {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.path_parts().join("/"))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct MediaFileStore {
    pub(crate) catalog: String,
    pub(crate) item: String,
    pub(crate) file: String,
}

impl MediaFileStore {
    pub(crate) fn file(&self, file_name: &str) -> FilePath {
        FilePath {
            catalog: self.catalog.clone(),
            item: self.item.clone(),
            file: self.file.clone(),
            file_name: file_name.to_owned(),
        }
    }

    pub(crate) fn media_item_store(&self) -> MediaItemStore {
        MediaItemStore {
            catalog: self.catalog.clone(),
            item: self.item.clone(),
        }
    }
}

impl PathLike for MediaFileStore {
    fn path_parts(&self) -> Vec<&str> {
        vec![&self.catalog, &self.item, &self.file]
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
    pub fn catalog_store(&self) -> CatalogStore {
        CatalogStore {
            catalog: self.catalog.clone(),
        }
    }

    pub fn media_item_store(&self) -> MediaItemStore {
        MediaItemStore {
            catalog: self.catalog.clone(),
            item: self.item.clone(),
        }
    }

    pub fn media_file_store(&self) -> MediaFileStore {
        MediaFileStore {
            catalog: self.catalog.clone(),
            item: self.item.clone(),
            file: self.file.clone(),
        }
    }
}

impl PathLike for FilePath {
    fn is_file(&self) -> bool {
        true
    }

    fn path_parts(&self) -> Vec<&str> {
        vec![&self.catalog, &self.item, &self.file, &self.file_name]
    }
}

impl fmt::Display for FilePath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.path_parts().join("/"))
    }
}

#[derive(Clone, Default)]
pub struct ResourceList {
    inner: HashMap<ResourcePath, u64>,
}

impl ResourceList {
    pub fn new() -> Self {
        Default::default()
    }

    pub fn len(&self) -> usize {
        self.inner.len()
    }

    pub fn contains_key<T: Clone + Into<ResourcePath>>(&self, path: &T) -> bool {
        self.inner.contains_key(&path.clone().into())
    }

    pub fn get<T: Clone + Into<ResourcePath>>(&self, path: &T) -> Option<u64> {
        self.inner.get(&path.clone().into()).copied()
    }

    pub fn remove<T: Clone + Into<ResourcePath>>(&mut self, path: &T) -> Option<u64> {
        self.inner.remove(&path.clone().into())
    }

    pub fn insert<T: Into<ResourcePath>>(&mut self, path: T, size: u64) {
        self.inner.insert(path.into(), size);
    }
}

impl<T> From<HashMap<T, u64>> for ResourceList
where
    T: Into<ResourcePath>,
{
    fn from(list: HashMap<T, u64>) -> Self {
        Self {
            inner: list.into_iter().map(|(t, size)| (t.into(), size)).collect(),
        }
    }
}

impl IntoIterator for ResourceList {
    type Item = <HashMap<ResourcePath, u64> as IntoIterator>::Item;

    type IntoIter = <HashMap<ResourcePath, u64> as IntoIterator>::IntoIter;

    fn into_iter(self) -> Self::IntoIter {
        self.inner.into_iter()
    }
}

impl Extend<(ResourcePath, u64)> for ResourceList {
    fn extend<T: IntoIterator<Item = (ResourcePath, u64)>>(&mut self, iter: T) {
        self.inner.extend(iter)
    }
}
