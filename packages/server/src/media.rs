use actix_web::{get, http::header, web, HttpResponse, Responder};
use pixelbin_shared::Error;
use pixelbin_store::{
    models::{self, AlternateFileType},
    DbQueries,
};
use scoped_futures::ScopedFutureExt;
use serde::{Deserialize, Serialize};
use serde_with::serde_as;
use tokio::fs::File;
use tokio_util::io::ReaderStream;
use tracing::instrument;

use crate::{
    auth::{MaybeSession, Session},
    util::choose_alternate,
    ApiResult, AppState,
};

#[derive(Debug, Deserialize)]
struct ThumbnailPath {
    item: String,
    file: String,
    size: u32,
    mimetype: String,
    _filename: String,
}

fn not_found() -> ApiResult<HttpResponse> {
    Ok(HttpResponse::NotFound()
        .content_type("text/plain")
        .body("Not Found"))
}

#[get("/media/{item}/{file}/thumb/{size}/{mimetype}/{_filename}")]
#[instrument(skip(app_state, session))]
async fn thumbnail_handler(
    app_state: web::Data<AppState>,
    session: MaybeSession,
    path: web::Path<ThumbnailPath>,
) -> ApiResult<impl Responder> {
    let email = session.session().map(|s| s.email.as_str());
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
        Err(Error::NotFound) => return not_found(),
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
        None => not_found(),
    }
}

fn default_true() -> bool {
    true
}

#[serde_as]
#[derive(Debug, Deserialize)]
struct AlbumListRequest {
    #[serde(default = "default_true")]
    recursive: bool,
}

#[derive(Serialize)]
struct AlbumListResponse {
    #[serde(flatten)]
    album: models::Album,
    media: Vec<models::MediaView>,
}

#[get("/api/album/{album_id}")]
#[instrument(skip(app_state, session))]
async fn album_list(
    app_state: web::Data<AppState>,
    session: Session,
    album_id: web::Path<String>,
    query: web::Query<AlbumListRequest>,
) -> ApiResult<web::Json<AlbumListResponse>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let album = trx.get_user_album(&session.email, &album_id).await?;
                let media = trx.list_album_media(&album, query.recursive).await?;

                Ok(AlbumListResponse { album, media })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(response))
}

#[derive(Serialize)]
struct SearchListResponse {
    #[serde(flatten)]
    search: models::SavedSearch,
    media: Vec<models::MediaView>,
}

#[get("/api/search/{search_id}")]
#[instrument(skip(app_state, session))]
async fn search_list(
    app_state: web::Data<AppState>,
    session: Session,
    search_id: web::Path<String>,
) -> ApiResult<web::Json<SearchListResponse>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let search = trx.get_user_search(&session.email, &search_id).await?;
                let media = trx.list_search_media(&search).await?;

                Ok(SearchListResponse { search, media })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(response))
}

#[derive(Serialize)]
struct CatalogListResponse {
    #[serde(flatten)]
    catalog: models::Catalog,
    media: Vec<models::MediaView>,
}

#[get("/api/catalog/{catalog_id}")]
#[instrument(skip(app_state, session))]
async fn catalog_list(
    app_state: web::Data<AppState>,
    session: Session,
    catalog_id: web::Path<String>,
) -> ApiResult<web::Json<CatalogListResponse>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let catalog = trx.get_user_catalog(&session.email, &catalog_id).await?;
                let media = trx.list_catalog_media(&catalog).await?;

                Ok(CatalogListResponse { catalog, media })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(response))
}
