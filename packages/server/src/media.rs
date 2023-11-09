use actix_web::{get, http::header, web, HttpResponse, Responder};
use pixelbin_shared::Error;
use pixelbin_store::{
    models::{self, AlternateFileType},
    RemotePath,
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

fn not_found() -> ApiResult<HttpResponse> {
    Ok(HttpResponse::NotFound()
        .content_type("text/plain")
        .body("Not Found"))
}

#[derive(Debug, Deserialize)]
struct DownloadPath {
    item: String,
    file: String,
    filename: String,
}

#[get("/media/download/{item}/{file}/{filename}")]
#[instrument(skip(app_state, session))]
async fn download_handler(
    app_state: web::Data<AppState>,
    session: Session,
    path: web::Path<DownloadPath>,
) -> ApiResult<impl Responder> {
    let filename = path.filename.clone();

    let (remote_path, storage, mimetype) = match app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (media_file, media_path) = trx
                    .get_user_media_file(&session.email, &path.item, &path.file)
                    .await?;

                let storage = trx.get_catalog_storage(&media_path.catalog).await?;
                let remote_path: RemotePath = media_path.into();

                Ok((
                    remote_path.join(&media_file.file_name),
                    storage,
                    media_file.mimetype,
                ))
            }
            .scope_boxed()
        })
        .await
    {
        Ok(result) => result,
        Err(Error::NotFound) => return not_found(),
        Err(e) => return Err(e.into()),
    };

    let uri = app_state
        .store
        .online_uri(&storage, &remote_path, &mimetype, Some(&filename))
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

#[get("/media/thumb/{item}/{file}/{size}/{mimetype}/{_filename}")]
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

#[derive(Debug, Deserialize)]
struct EncodingPath {
    item: String,
    file: String,
    mimetype: String,
    _filename: String,
}

#[get("/media/encoding/{item}/{file}/{mimetype}/{_filename}")]
#[instrument(skip(app_state, session))]
async fn encoding_handler(
    app_state: web::Data<AppState>,
    session: MaybeSession,
    path: web::Path<EncodingPath>,
) -> ApiResult<impl Responder> {
    let email = session.session().map(|s| s.email.as_str());
    let mimetype = path.mimetype.replace('-', "/");
    let tx_mime = mimetype.clone();

    let (remote_path, storage) = match app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (alternate, media_path, _) = trx
                    .list_media_alternates(
                        email,
                        &path.item,
                        &path.file,
                        &tx_mime,
                        AlternateFileType::Reencode,
                    )
                    .await?
                    .into_iter()
                    .next()
                    .ok_or_else(|| Error::NotFound)?;

                let storage = trx.get_catalog_storage(&media_path.catalog).await?;
                let remote_path: RemotePath = media_path.into();

                Ok((remote_path.join(&alternate.file_name), storage))
            }
            .scope_boxed()
        })
        .await
    {
        Ok(alternate) => alternate,
        Err(Error::NotFound) => return not_found(),
        Err(e) => return Err(e.into()),
    };

    let uri = app_state
        .store
        .online_uri(&storage, &remote_path, &mimetype, None)
        .await?;

    Ok(HttpResponse::TemporaryRedirect()
        .append_header(("Location", uri))
        .finish())
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
struct AlbumResponse {
    #[serde(flatten)]
    album: models::Album,
    media: i64,
}

#[get("/api/album/{album_id}")]
#[instrument(skip(app_state, session))]
async fn get_album(
    app_state: web::Data<AppState>,
    session: Session,
    album_id: web::Path<String>,
    query: web::Query<AlbumListRequest>,
) -> ApiResult<web::Json<AlbumResponse>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (album, media) = trx.get_user_album(&session.email, &album_id).await?;

                Ok(AlbumResponse { album, media })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(response))
}

#[derive(Serialize)]
struct SearchResponse {
    #[serde(flatten)]
    search: models::SavedSearch,
    media: i64,
}

#[get("/api/search/{search_id}")]
#[instrument(skip(app_state, session))]
async fn get_search(
    app_state: web::Data<AppState>,
    session: Session,
    search_id: web::Path<String>,
) -> ApiResult<web::Json<SearchResponse>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (search, media) = trx.get_user_search(&session.email, &search_id).await?;

                Ok(SearchResponse { search, media })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(response))
}

#[derive(Serialize)]
struct CatalogResponse {
    #[serde(flatten)]
    catalog: models::Catalog,
    media: i64,
}

#[get("/api/catalog/{catalog_id}")]
#[instrument(skip(app_state, session))]
async fn get_catalog(
    app_state: web::Data<AppState>,
    session: Session,
    catalog_id: web::Path<String>,
) -> ApiResult<web::Json<CatalogResponse>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (catalog, media) = trx.get_user_catalog(&session.email, &catalog_id).await?;

                Ok(CatalogResponse { catalog, media })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(response))
}

#[derive(Debug, Deserialize)]
struct GetMediaRequest {
    offset: Option<i64>,
    count: Option<i64>,
}

#[derive(Debug, Serialize)]
struct GetMediaResponse {
    total: i64,
    media: Vec<models::MediaView>,
}

#[get("/api/catalog/{catalog_id}/media")]
#[instrument(skip(app_state, session))]
async fn get_catalog_media(
    app_state: web::Data<AppState>,
    session: Session,
    catalog_id: web::Path<String>,
    query: web::Query<GetMediaRequest>,
) -> ApiResult<web::Json<GetMediaResponse>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (catalog, media_count) =
                    trx.get_user_catalog(&session.email, &catalog_id).await?;
                let media = trx
                    .list_catalog_media(&catalog, query.offset, query.count)
                    .await?;

                Ok(GetMediaResponse {
                    total: media_count,
                    media,
                })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(response))
}

#[get("/api/album/{album_id}/media")]
#[instrument(skip(app_state, session))]
async fn get_album_media(
    app_state: web::Data<AppState>,
    session: Session,
    album_id: web::Path<String>,
    query: web::Query<GetMediaRequest>,
) -> ApiResult<web::Json<GetMediaResponse>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (album, media_count) = trx.get_user_album(&session.email, &album_id).await?;
                let media = trx
                    .list_album_media(&album, query.offset, query.count)
                    .await?;

                Ok(GetMediaResponse {
                    total: media_count,
                    media,
                })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(response))
}

#[get("/api/search/{search_id}/media")]
#[instrument(skip(app_state, session))]
async fn get_search_media(
    app_state: web::Data<AppState>,
    session: Session,
    search_id: web::Path<String>,
    query: web::Query<GetMediaRequest>,
) -> ApiResult<web::Json<GetMediaResponse>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (search, media_count) = trx.get_user_search(&session.email, &search_id).await?;
                let media = trx
                    .list_search_media(&search, query.offset, query.count)
                    .await?;

                Ok(GetMediaResponse {
                    total: media_count,
                    media,
                })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(response))
}

#[get("/api/media/{media_id}")]
#[instrument(skip(app_state, session))]
async fn get_media(
    app_state: web::Data<AppState>,
    session: Session,
    media_id: web::Path<String>,
) -> ApiResult<web::Json<GetMediaResponse>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let media = trx.get_user_media(&session.email, &[&media_id]).await?;

                Ok(GetMediaResponse { total: 1, media })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(response))
}
