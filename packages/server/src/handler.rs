use actix_web::{get, http::header, web, HttpRequest, HttpResponse, Responder};
use askama::Template;
use mime_guess::from_path;
use pixelbin_shared::{Error, Result};
use pixelbin_store::{models::AlternateFileType, DbQueries};
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
    templates::{self, build_catalog_navs},
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
async fn index(app_state: web::Data<AppState>, session: Session) -> HttpResult<impl Responder> {
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
async fn album(
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
                let album = trx.user_album(&email, &album_id).await?;
                let media = trx
                    .user_album_media(&email, &album_id, query.recursive)
                    .await?;

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
async fn thumbnail(
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
