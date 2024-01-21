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

    let (media_file_path, storage, mimetype, file_name) = match app_state
        .store
        .in_transaction(|conn| {
            async move {
                let (media_file, file_path) = models::MediaFile::get_for_user_media(
                    conn,
                    &session.user.email,
                    &path.item,
                    &path.file,
                )
                .await?;

                let storage = models::Storage::get_for_catalog(conn, &file_path.catalog).await?;

                Ok((
                    file_path,
                    storage,
                    media_file.mimetype,
                    media_file.file_name,
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

    let file_path = media_file_path.file(file_name);
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
        .in_transaction(|conn| {
            async move {
                models::AlternateFile::list_for_user_media(
                    conn,
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
        .in_transaction(|conn| {
            async move {
                let (_, file_path) = models::AlternateFile::list_for_user_media(
                    conn,
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

                let storage = models::Storage::get_for_catalog(conn, &file_path.catalog).await?;

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

#[derive(Debug, Deserialize)]
pub(crate) struct GetMediaRequest {
    pub(crate) offset: Option<i64>,
    pub(crate) count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub(crate) struct GetMediaResponse<T> {
    pub(crate) total: i64,
    pub(crate) media: Vec<T>,
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
        .in_transaction(|conn| {
            async move {
                let media =
                    models::MediaRelations::get_for_user(conn, &session.user.email, &ids).await?;

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
