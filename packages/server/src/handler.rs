use actix_web::{get, http::header, web, HttpRequest, HttpResponse, Responder};
use askama::Template;
use mime_guess::from_path;
use pixelbin_shared::{Error, Result};
use pixelbin_store::{models::AlternateFileType, DbQueries, RemotePath};
use rust_embed::RustEmbed;
use scoped_futures::ScopedFutureExt;
use serde::Deserialize;
use serde_with::serde_as;
use time::OffsetDateTime;
use tokio::fs::File;
use tokio_util::io::ReaderStream;
use tracing::instrument;

use crate::{
    middleware::cacheable,
    templates::{self, build_catalog_navs, Collection},
    util::{build_base_state, choose_alternate, group_by_taken},
    AppState,
};
use crate::{util::HttpResult, Session};

#[derive(RustEmbed)]
#[folder = "../../target/web/static/"]
struct StaticAssets;

async fn not_found(app_state: &AppState, session: &Session) -> Result<HttpResponse> {
    let base = app_state
        .store
        .in_transaction(|mut trx| {
            async move { build_base_state(&mut trx, session).await }.scope_boxed()
        })
        .await?;

    let template = templates::NotFound {
        catalogs: build_catalog_navs(&base),
        user: base.user,
    };

    Ok(HttpResponse::NotFound()
        .content_type("text/html")
        .body(template.render().unwrap()))
}

#[get("/")]
#[instrument(skip_all)]
async fn index_handler(
    app_state: web::Data<AppState>,
    session: Session,
) -> HttpResult<impl Responder> {
    let base = app_state
        .store
        .in_transaction(|mut trx| {
            async move { build_base_state(&mut trx, &session).await }.scope_boxed()
        })
        .await?;

    let template = templates::Index {
        catalogs: build_catalog_navs(&base),
        user: base.user,
    };

    Ok(HttpResponse::Ok()
        .content_type("text/html")
        .body(template.render().unwrap()))
}

#[get("/album/{album_id}/media/{media_id}")]
#[instrument(skip(app_state, session))]
async fn album_media_handler(
    app_state: web::Data<AppState>,
    session: Session,
    path: web::Path<(String, String)>,
) -> HttpResult<impl Responder> {
    let (album_id, media_id) = path.into_inner();

    let email = if let Some(ref email) = session.email {
        email.to_owned()
    } else {
        return Ok(not_found(&app_state, &session).await?);
    };

    match app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let album = trx.get_user_album(&email, &album_id).await?;
                let user = trx.get_user(&email).await?;
                let all_media = trx.list_album_media(&album, true).await?;
                let (index, media) = all_media
                    .iter()
                    .enumerate()
                    .find(|(_, m)| m.id == media_id)
                    .ok_or_else(|| Error::NotFound)?;

                let next = all_media.get(index + 1).map(|mv| mv.id.clone());
                let previous = if index > 0 {
                    all_media.get(index - 1).map(|mv| mv.id.clone())
                } else {
                    None
                };

                Ok(templates::Photo {
                    catalogs: vec![],
                    user: Some(user),
                    collection: Collection::Album(album),
                    previous,
                    next,
                    media: media.clone(),
                })
            }
            .scope_boxed()
        })
        .await
    {
        Ok(template) => Ok(HttpResponse::Ok()
            .content_type("text/html")
            .body(template.render().unwrap())),
        Err(Error::NotFound) => Ok(not_found(&app_state, &session).await?),
        Err(e) => Err(e.into()),
    }
}

fn default_true() -> bool {
    true
}

#[serde_as]
#[derive(Debug, Deserialize)]
struct AlbumQuery {
    #[serde(default = "default_true")]
    recursive: bool,
}

#[get("/album/{album_id}")]
#[instrument(skip(app_state, session))]
async fn album_handler(
    app_state: web::Data<AppState>,
    session: Session,
    album_id: web::Path<String>,
    query: web::Query<AlbumQuery>,
) -> HttpResult<impl Responder> {
    let config = app_state.store.config().clone();

    let email = if let Some(ref email) = session.email {
        email.to_owned()
    } else {
        return Ok(not_found(&app_state, &session).await?);
    };

    let sess = session.clone();
    match app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let album = trx.get_user_album(&email, &album_id).await?;
                let media = trx.list_album_media(&album, query.recursive).await?;

                let media_groups = group_by_taken(media);

                let base = build_base_state(&mut trx, &sess).await?;

                Ok(templates::Album {
                    catalogs: build_catalog_navs(&base),
                    user: base.user,
                    album: album.clone(),
                    media_groups: media_groups.clone(),
                    thumbnails: config.thumbnails.clone(),
                })
            }
            .scope_boxed()
        })
        .await
    {
        Ok(template) => Ok(HttpResponse::Ok()
            .content_type("text/html")
            .body(template.render().unwrap())),
        Err(Error::NotFound) => Ok(not_found(&app_state, &session).await?),
        Err(e) => Err(e.into()),
    }
}

#[get("/search/{search_id}/media/{media_id}")]
#[instrument(skip(app_state, session))]
async fn search_media_handler(
    app_state: web::Data<AppState>,
    session: Session,
    path: web::Path<(String, String)>,
) -> HttpResult<impl Responder> {
    let (search_id, media_id) = path.into_inner();

    let email = if let Some(ref email) = session.email {
        email.to_owned()
    } else {
        return Ok(not_found(&app_state, &session).await?);
    };

    match app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let search = trx.get_user_search(&email, &search_id).await?;
                let user = trx.get_user(&email).await?;
                let all_media = trx.list_search_media(&search).await?;
                let (index, media) = all_media
                    .iter()
                    .enumerate()
                    .find(|(_, m)| m.id == media_id)
                    .ok_or_else(|| Error::NotFound)?;

                let next = all_media.get(index + 1).map(|mv| mv.id.clone());
                let previous = if index > 0 {
                    all_media.get(index - 1).map(|mv| mv.id.clone())
                } else {
                    None
                };

                Ok(templates::Photo {
                    catalogs: vec![],
                    user: Some(user),
                    collection: Collection::Search(search),
                    previous,
                    next,
                    media: media.clone(),
                })
            }
            .scope_boxed()
        })
        .await
    {
        Ok(template) => Ok(HttpResponse::Ok()
            .content_type("text/html")
            .body(template.render().unwrap())),
        Err(Error::NotFound) => Ok(not_found(&app_state, &session).await?),
        Err(e) => Err(e.into()),
    }
}

#[get("/search/{search_id}")]
#[instrument(skip(app_state, session))]
async fn search_handler(
    app_state: web::Data<AppState>,
    session: Session,
    search_id: web::Path<String>,
) -> HttpResult<impl Responder> {
    let config = app_state.store.config().clone();

    let email = if let Some(ref email) = session.email {
        email.to_owned()
    } else {
        return Ok(not_found(&app_state, &session).await?);
    };

    let sess = session.clone();
    match app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let search = trx.get_user_search(&email, &search_id).await?;
                let media = trx.list_search_media(&search).await?;

                let media_groups = group_by_taken(media);

                let base = build_base_state(&mut trx, &sess).await?;

                Ok(templates::Search {
                    catalogs: build_catalog_navs(&base),
                    user: base.user,
                    search: search.clone(),
                    media_groups: media_groups.clone(),
                    thumbnails: config.thumbnails.clone(),
                })
            }
            .scope_boxed()
        })
        .await
    {
        Ok(template) => Ok(HttpResponse::Ok()
            .content_type("text/html")
            .body(template.render().unwrap())),
        Err(Error::NotFound) => Ok(not_found(&app_state, &session).await?),
        Err(e) => Err(e.into()),
    }
}

#[get("/media/{item}/{file}/encoding/{mimetype}/{_filename}")]
#[instrument(skip(app_state, session))]
async fn encoding_handler(
    app_state: web::Data<AppState>,
    session: Session,
    path: web::Path<(String, String, String, String)>,
) -> HttpResult<impl Responder> {
    let (item_id, file_id, mimetype, _) = path.into_inner();

    let email = session.email.as_deref();
    let mimetype = mimetype.replace('-', "/");
    let tx_mime = mimetype.clone();

    let (remote_path, storage) = match app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (alternate, media_path, _) = trx
                    .list_media_alternates(
                        email,
                        &item_id,
                        &file_id,
                        &tx_mime,
                        AlternateFileType::Reencode,
                    )
                    .await?
                    .into_iter()
                    .next()
                    .ok_or_else(|| Error::NotFound)?;

                let storage = trx.get_catalog_storage(&media_path.catalog).await?;
                let remote_path: RemotePath = media_path.into();
                remote_path.join(&alternate.file_name);

                Ok((remote_path.join(&alternate.file_name), storage))
            }
            .scope_boxed()
        })
        .await
    {
        Ok(alternate) => alternate,
        Err(Error::NotFound) => return Ok(not_found(&app_state, &session).await?),
        Err(e) => return Err(e.into()),
    };

    let uri = app_state
        .store
        .online_uri(&storage, &remote_path, &mimetype)
        .await?;

    Ok(HttpResponse::TemporaryRedirect()
        .append_header(("Location", uri))
        .finish())
}

#[derive(Debug, Deserialize)]
struct ThumbnailPath {
    item: String,
    file: String,
    size: u32,
    mimetype: String,
    _filename: String,
}

#[get("/media/{item}/{file}/thumb/{size}/{mimetype}/{_filename}")]
#[instrument(skip(app_state, session))]
async fn thumbnail_handler(
    app_state: web::Data<AppState>,
    session: Session,
    path: web::Path<ThumbnailPath>,
) -> HttpResult<impl Responder> {
    let email = session.email.as_deref();
    let mimetype = path.mimetype.replace('-', "/");
    let target_size = path.size as i32;

    let alternates = match app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                trx.list_media_alternates(
                    email,
                    &path.item,
                    &path.file,
                    &mimetype,
                    AlternateFileType::Thumbnail,
                )
                .await
            }
            .scope_boxed()
        })
        .await
    {
        Ok(alternates) => alternates,
        Err(Error::NotFound) => return Ok(not_found(&app_state, &session).await?),
        Err(e) => return Err(e.into()),
    };

    match choose_alternate(alternates, target_size) {
        Some((alternate, _media_path, path)) => {
            let file = File::open(&path).await?;
            let stream = ReaderStream::new(file);

            Ok(HttpResponse::Ok()
                .content_type(alternate.mimetype.clone())
                .append_header((header::CACHE_CONTROL, "max-age=1314000,immutable"))
                .append_header((header::CONTENT_LENGTH, alternate.file_size))
                .streaming(stream))
        }
        None => Ok(not_found(&app_state, &session).await?),
    }
}

#[get("/static/{_:.*}")]
#[instrument(skip(request))]
async fn static_files(path: web::Path<String>, request: HttpRequest) -> HttpResult<impl Responder> {
    let local_path = path.to_owned();

    match StaticAssets::get(&local_path) {
        Some(content) => {
            let last_modified = content
                .metadata
                .last_modified()
                .and_then(|lm| OffsetDateTime::from_unix_timestamp(lm as i64).ok());

            Ok(cacheable(&request, last_modified, || {
                Box::pin(async move {
                    Ok(HttpResponse::Ok()
                        .content_type(from_path(local_path).first_or_octet_stream().as_ref())
                        .body(content.data.into_owned()))
                })
            })
            .await?)
        }
        None => Ok(HttpResponse::NotFound().body("404 Not Found")),
    }
}
