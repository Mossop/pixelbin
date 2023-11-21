use actix_web::{get, http::header, post, web, HttpResponse, Responder};
use chrono::NaiveDateTime;
use scoped_futures::ScopedFutureExt;
use serde::{Deserialize, Serialize};
use tokio::fs::File;
use tokio_util::io::ReaderStream;
use tracing::instrument;

use super::{
    auth::{MaybeSession, Session},
    util::choose_alternate,
    ApiResult, AppState,
};
use crate::store::models::{self, AlternateFileType, Location};
use crate::Error;

#[derive(Serialize)]
struct ApiResponse {
    message: String,
}

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
#[instrument(err, skip(app_state, session))]
async fn download_handler(
    app_state: web::Data<AppState>,
    session: Session,
    path: web::Path<DownloadPath>,
) -> ApiResult<impl Responder> {
    let filename = path.filename.clone();

    let (file_path, storage, mimetype) = match app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (media_file, file_path) = models::MediaFile::get_for_user_media(
                    &mut trx,
                    &session.user.email,
                    &path.item,
                    &path.file,
                )
                .await?;

                let storage =
                    models::Storage::get_for_catalog(&mut trx, &file_path.catalog).await?;

                Ok((file_path, storage, media_file.mimetype))
            }
            .scope_boxed()
        })
        .await
    {
        Ok(result) => result,
        Err(Error::NotFound) => return not_found(),
        Err(e) => return Err(e.into()),
    };

    let uri = storage
        .online_uri(&file_path, &mimetype, Some(&filename))
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
#[instrument(err, skip(app_state, session))]
async fn thumbnail_handler(
    app_state: web::Data<AppState>,
    session: MaybeSession,
    path: web::Path<ThumbnailPath>,
) -> ApiResult<impl Responder> {
    let email = session.session().map(|s| s.user.email.as_str());
    let mimetype = path.mimetype.replace('-', "/");
    let target_size = path.size as i32;

    let alternates = match app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                models::AlternateFile::list_for_user_media(
                    &mut trx,
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
        Some((alternate, media_path)) => {
            let path = app_state
                .store
                .config()
                .local_store()
                .local_path(&media_path);
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
#[instrument(err, skip(app_state, session))]
async fn encoding_handler(
    app_state: web::Data<AppState>,
    session: MaybeSession,
    path: web::Path<EncodingPath>,
) -> ApiResult<impl Responder> {
    let email = session.session().map(|s| s.user.email.as_str());
    let mimetype = path.mimetype.replace('-', "/");
    let tx_mime = mimetype.clone();

    let (file_path, storage) = match app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (_, file_path) = models::AlternateFile::list_for_user_media(
                    &mut trx,
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

                let storage =
                    models::Storage::get_for_catalog(&mut trx, &file_path.catalog).await?;

                Ok((file_path, storage))
            }
            .scope_boxed()
        })
        .await
    {
        Ok(alternate) => alternate,
        Err(Error::NotFound) => return not_found(),
        Err(e) => return Err(e.into()),
    };

    let uri = storage.online_uri(&file_path, &mimetype, None).await?;

    Ok(HttpResponse::TemporaryRedirect()
        .append_header(("Location", uri))
        .finish())
}

fn default_true() -> bool {
    true
}

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
#[instrument(err, skip(app_state, session))]
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
                let (album, media) = models::Album::get_for_user_with_count(
                    &mut trx,
                    &session.user.email,
                    &album_id,
                    query.recursive,
                )
                .await?;

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
#[instrument(err, skip(app_state, session))]
async fn get_search(
    app_state: web::Data<AppState>,
    session: Session,
    search_id: web::Path<String>,
) -> ApiResult<web::Json<SearchResponse>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (search, media) =
                    models::SavedSearch::get_for_user_with_count(
                        &mut trx,
                        &session.user.email,
                        &search_id,
                    )
                    .await?;

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
#[instrument(err, skip(app_state, session))]
async fn get_catalog(
    app_state: web::Data<AppState>,
    session: Session,
    catalog_id: web::Path<String>,
) -> ApiResult<web::Json<CatalogResponse>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (catalog, media) =
                    models::Catalog::get_for_user_with_count(
                        &mut trx,
                        &session.user.email,
                        &catalog_id,
                    )
                    .await?;

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
struct GetMediaResponse<T> {
    total: i64,
    media: Vec<T>,
}

#[get("/api/catalog/{catalog_id}/media")]
#[instrument(err, skip(app_state, session))]
async fn get_catalog_media(
    app_state: web::Data<AppState>,
    session: Session,
    catalog_id: web::Path<String>,
    query: web::Query<GetMediaRequest>,
) -> ApiResult<web::Json<GetMediaResponse<models::MediaView>>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (catalog, media_count) =
                    models::Catalog::get_for_user_with_count(
                        &mut trx,
                        &session.user.email,
                        &catalog_id,
                    )
                    .await?;
                let media = catalog
                    .list_media(&mut trx, query.offset, query.count)
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

#[derive(Debug, Deserialize)]
struct GetRecursiveMediaRequest {
    offset: Option<i64>,
    count: Option<i64>,
    #[serde(default = "default_true")]
    recursive: bool,
}

#[get("/api/album/{album_id}/media")]
#[instrument(err, skip(app_state, session))]
async fn get_album_media(
    app_state: web::Data<AppState>,
    session: Session,
    album_id: web::Path<String>,
    query: web::Query<GetRecursiveMediaRequest>,
) -> ApiResult<web::Json<GetMediaResponse<models::MediaView>>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (album, media_count) = models::Album::get_for_user_with_count(
                    &mut trx,
                    &session.user.email,
                    &album_id,
                    query.recursive,
                )
                .await?;
                let media = album
                    .list_media(&mut trx, query.recursive, query.offset, query.count)
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
#[instrument(err, skip(app_state, session))]
async fn get_search_media(
    app_state: web::Data<AppState>,
    session: Session,
    search_id: web::Path<String>,
    query: web::Query<GetMediaRequest>,
) -> ApiResult<web::Json<GetMediaResponse<models::MediaView>>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let (search, media_count) =
                    models::SavedSearch::get_for_user_with_count(
                        &mut trx,
                        &session.user.email,
                        &search_id,
                    )
                    .await?;
                let media = search
                    .list_media(&mut trx, query.offset, query.count)
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
#[instrument(err, skip(app_state, session))]
async fn get_media(
    app_state: web::Data<AppState>,
    session: Session,
    media_ids: web::Path<String>,
) -> ApiResult<web::Json<GetMediaResponse<models::MediaRelations>>> {
    let ids: Vec<&str> = media_ids.split(',').to_owned().collect::<Vec<&str>>();

    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let media =
                    models::MediaRelations::get_for_user(&mut trx, &session.user.email, &ids)
                        .await?;

                Ok(GetMediaResponse {
                    total: media.len() as i64,
                    media,
                })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(response))
}

#[post("/api/media/delete")]
#[instrument(err, skip(app_state, session, media_ids))]
async fn delete_media(
    app_state: web::Data<AppState>,
    session: Session,
    media_ids: web::Json<Vec<String>>,
) -> ApiResult<web::Json<ApiResponse>> {
    eprintln!("{media_ids:#?}");
    todo!();
}

#[derive(Deserialize, Clone, Debug)]
struct MediaMetadata {
    filename: Option<String>,
    title: Option<String>,
    description: Option<String>,
    label: Option<String>,
    category: Option<String>,
    location: Option<String>,
    city: Option<String>,
    state: Option<String>,
    country: Option<String>,
    make: Option<String>,
    model: Option<String>,
    lens: Option<String>,
    photographer: Option<String>,
    shutter_speed: Option<String>,
    orientation: Option<i32>,
    iso: Option<i32>,
    rating: Option<i32>,
    longitude: Option<f32>,
    latitude: Option<f32>,
    altitude: Option<f32>,
    aperture: Option<f32>,
    focal_length: Option<f32>,
    taken: Option<NaiveDateTime>,
}

#[derive(Deserialize, Clone, Debug)]
struct MediaPerson {
    name: String,
    location: Option<Location>,
}

#[derive(Deserialize, Clone, Debug)]
struct MediaCreate {
    catalog: String,
    media: Option<MediaMetadata>,
    tags: Option<Vec<String>>,
    people: Option<Vec<MediaPerson>>,
}

#[post("/api/media/create")]
#[instrument(err, skip(app_state, session, media))]
async fn create_media(
    app_state: web::Data<AppState>,
    session: Session,
    media: web::Json<MediaCreate>,
) -> ApiResult<web::Json<ApiResponse>> {
    eprintln!("{media:#?}");
    todo!();
}

#[derive(Deserialize, Clone, Debug)]
struct MediaUpdate {
    id: String,
    media: Option<MediaMetadata>,
    tags: Option<Vec<String>>,
    people: Option<Vec<MediaPerson>>,
}

#[post("/api/media/edit")]
#[instrument(err, skip(app_state, session, media))]
async fn edit_media(
    app_state: web::Data<AppState>,
    session: Session,
    media: web::Json<MediaUpdate>,
) -> ApiResult<web::Json<ApiResponse>> {
    eprintln!("{media:#?}");
    todo!();
}
