use askama::Template;
use pixelbin_shared::ThumbnailConfig;
use pixelbin_store::models;
use tracing::instrument;

use crate::util::{BaseTemplateState, MediaGroup};

mod filters {
    use std::fmt::Display;

    pub(super) fn default<T, D>(val: &Option<T>, default: D) -> askama::Result<String>
    where
        T: Display,
        D: Display,
    {
        match val {
            Some(v) => Ok(v.to_string()),
            None => Ok(default.to_string()),
        }
    }

    pub(super) fn mime_extension<T>(mimetype: T) -> askama::Result<String>
    where
        T: Display,
    {
        match mimetype.to_string().as_str() {
            "image/jpeg" => Ok("jpg".to_string()),
            other => match other.rfind('/') {
                Some(idx) => Ok(other[idx + 1..].to_string()),
                None => Ok(other.to_owned()),
            },
        }
    }

    pub(super) fn strip_extension<T>(filename: T) -> askama::Result<String>
    where
        T: Display,
    {
        let str = filename.to_string();

        if let Some(index) = str.rfind('.') {
            Ok(str[0..index].to_string())
        } else {
            Ok(str)
        }
    }
}

#[instrument(level = "trace", skip(searches))]
fn build_catalog_searches(
    searches: &[models::SavedSearch],
    catalog: &str,
) -> Vec<models::SavedSearch> {
    searches
        .iter()
        .filter_map(|s| {
            if s.catalog.as_str() == catalog {
                Some(s.clone())
            } else {
                None
            }
        })
        .collect()
}

fn build_album_children(albums: &[models::Album], alb: &str) -> Vec<AlbumNav> {
    albums
        .iter()
        .filter_map(|a| {
            if a.parent.as_deref() == Some(alb) {
                Some(AlbumNav {
                    album: a.clone(),
                    children: build_album_children(albums, &a.id),
                })
            } else {
                None
            }
        })
        .collect()
}

#[instrument(level = "trace", skip(albums))]
fn build_catalog_albums(albums: &[models::Album], catalog: &str) -> Vec<AlbumNav> {
    albums
        .iter()
        .filter_map(|a| {
            if a.catalog == catalog && a.parent.is_none() {
                Some(AlbumNav {
                    album: a.clone(),
                    children: build_album_children(albums, &a.id),
                })
            } else {
                None
            }
        })
        .collect()
}

#[instrument(level = "trace", skip_all)]
pub(crate) fn build_catalog_navs(base: &BaseTemplateState) -> Vec<CatalogNav> {
    base.catalogs
        .iter()
        .map(|c| CatalogNav {
            catalog: c.clone(),
            searches: build_catalog_searches(&base.searches, &c.id),
            albums: build_catalog_albums(&base.albums, &c.id),
        })
        .collect()
}

#[derive(Template)]
#[template(path = "includes/album-nav.html")]
pub(crate) struct AlbumNav {
    pub(crate) album: models::Album,
    pub(crate) children: Vec<AlbumNav>,
}

pub(crate) struct CatalogNav {
    pub(crate) catalog: models::Catalog,
    pub(crate) searches: Vec<models::SavedSearch>,
    pub(crate) albums: Vec<AlbumNav>,
}

#[derive(Template)]
#[template(path = "index.html")]
pub(crate) struct Index {
    pub(crate) user: Option<models::User>,
    pub(crate) catalogs: Vec<CatalogNav>,
}

#[derive(Template)]
#[template(path = "notfound.html")]
pub(crate) struct NotFound {
    pub(crate) user: Option<models::User>,
    pub(crate) catalogs: Vec<CatalogNav>,
}

#[derive(Template)]
#[template(path = "album.html")]
pub(crate) struct Album {
    pub(crate) user: Option<models::User>,
    pub(crate) catalogs: Vec<CatalogNav>,
    pub(crate) album: models::Album,
    pub(crate) media_groups: Vec<MediaGroup>,
    pub(crate) thumbnails: ThumbnailConfig,
}
