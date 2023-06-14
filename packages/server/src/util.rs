use std::{cmp::max, collections::BTreeMap, fmt, io, path::PathBuf};

use actix_web::{
    body::BoxBody,
    http::header::{self, TryIntoHeaderValue},
    HttpResponse, ResponseError,
};
use nano_id::base62;
use pixelbin_shared::Error;
use pixelbin_store::{models, DbQueries, MediaFilePath};
use serde::Serialize;
use time::{format_description::FormatItem, macros::format_description, Month, UtcOffset};
use tracing::instrument;

use crate::{Result, Session};

const ZONE_FORMAT: &[FormatItem<'_>] =
    format_description!("UTC[offset_hour padding:none sign:mandatory]");

pub(crate) fn long_id(prefix: &str) -> String {
    format!("{prefix}:{}", base62::<25>())
}

// pub(crate) fn short_id(prefix: &str) -> String {
//     format!("{prefix}:{}", base62::<10>())
// }

#[derive(Debug)]
pub(crate) struct InternalError {
    inner: Error,
}

impl fmt::Display for InternalError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.inner.fmt(f)
    }
}

impl From<Error> for InternalError {
    fn from(value: Error) -> Self {
        Self { inner: value }
    }
}

impl From<io::Error> for InternalError {
    fn from(value: io::Error) -> Self {
        Self {
            inner: value.into(),
        }
    }
}

impl ResponseError for InternalError {
    fn error_response(&self) -> HttpResponse<BoxBody> {
        let mut res = HttpResponse::new(self.status_code());
        let message = format!("{}", self);

        tracing::error!(message = message);

        let mime = mime::TEXT_PLAIN_UTF_8.try_into_value().unwrap();
        res.headers_mut().insert(header::CONTENT_TYPE, mime);

        res.set_body(BoxBody::new(message))
    }
}

pub(crate) type HttpResult<T> = std::result::Result<T, InternalError>;

#[derive(Serialize)]
pub(crate) struct MediaGroup {
    pub(crate) title: String,
    pub(crate) media: Vec<models::MediaView>,
}

pub(crate) fn group_by_taken(media_list: Vec<models::MediaView>) -> Vec<MediaGroup> {
    let mut groups: BTreeMap<(i32, u8), Vec<models::MediaView>> = BTreeMap::new();
    let mut remains: Vec<models::MediaView> = Vec::new();

    for media in media_list {
        let zone = media
            .taken_zone
            .as_deref()
            .and_then(|zstr| UtcOffset::parse(zstr, ZONE_FORMAT).ok());

        let dt = match (media.taken, zone) {
            (Some(ref pdt), Some(offset)) => pdt.assume_offset(offset),
            (Some(ref pdt), None) => pdt.assume_utc(),
            _ => {
                remains.push(media);
                continue;
            }
        };

        let key = (dt.year(), dt.month().into());
        if let Some(list) = groups.get_mut(&key) {
            list.push(media);
            continue;
        }

        groups.insert(key, vec![media]);
    }

    let mut groups: Vec<MediaGroup> = groups
        .into_iter()
        .map(|((year, month), media)| MediaGroup {
            title: format!("{} {year}", Month::try_from(month).unwrap()),
            media,
        })
        .collect();

    groups.reverse();

    if !remains.is_empty() {
        groups.push(MediaGroup {
            title: "Unknown".to_string(),
            media: remains,
        });
    }

    groups
}

#[derive(Serialize)]
pub(crate) struct AlbumNav {
    #[serde(flatten)]
    pub(crate) album: models::Album,
    pub(crate) children: Vec<AlbumNav>,
}

#[derive(Serialize)]
pub(crate) struct CatalogNav {
    #[serde(flatten)]
    pub(crate) catalog: models::Catalog,
    pub(crate) searches: Vec<models::SavedSearch>,
    pub(crate) albums: Vec<AlbumNav>,
}

#[derive(Serialize)]
pub(crate) struct UserNav {
    pub(crate) catalogs: Vec<CatalogNav>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UserState {
    #[serde(flatten)]
    pub(crate) user: models::User,
    #[serde(flatten)]
    pub(crate) nav: UserNav,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiState {
    pub(crate) user: Option<UserState>,
}

fn alt_size(alt: &(models::AlternateFile, MediaFilePath, PathBuf)) -> i32 {
    max(alt.0.width, alt.0.height)
}

pub(crate) fn choose_alternate(
    mut alternates: Vec<(models::AlternateFile, MediaFilePath, PathBuf)>,
    size: i32,
) -> Option<(models::AlternateFile, MediaFilePath, PathBuf)> {
    if alternates.is_empty() {
        return None;
    }

    let mut chosen = alternates.swap_remove(0);

    for alternate in alternates {
        if (size - alt_size(&chosen)).abs() > (size - alt_size(&alternate)).abs() {
            chosen = alternate;
        }
    }

    Some(chosen)
}

fn build_searches(
    searches: &mut Vec<models::SavedSearch>,
    catalog: &str,
) -> Vec<models::SavedSearch> {
    let mut result = Vec::new();

    let mut i = 0;
    while i < searches.len() {
        if searches[i].catalog == catalog {
            result.push(searches.swap_remove(i));
        } else {
            i += 1;
        }
    }

    result
}

fn build_album_children(albums: &Vec<models::Album>, alb: &str) -> Vec<AlbumNav> {
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

fn build_catalog_albums(albums: &Vec<models::Album>, catalog: &str) -> Vec<AlbumNav> {
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

#[instrument(skip_all, err)]
pub(crate) async fn build_state<Q: DbQueries + Send>(
    db: &mut Q,
    session: &Session,
) -> Result<ApiState> {
    if let Some(ref email) = session.email {
        let user = db.user(email).await?;
        let catalogs = db.list_user_catalogs(email).await?;
        let albums = db.list_user_albums(email).await?;
        let mut searches = db.list_user_searches(email).await?;

        let catalog_nav = catalogs
            .into_iter()
            .map(|catalog| CatalogNav {
                albums: build_catalog_albums(&albums, &catalog.id),
                searches: build_searches(&mut searches, &catalog.id),
                catalog,
            })
            .collect::<Vec<CatalogNav>>();

        Ok(ApiState {
            user: Some(UserState {
                user,
                nav: UserNav {
                    catalogs: catalog_nav,
                },
            }),
        })
    } else {
        Ok(ApiState { user: None })
    }
}
