use actix_multipart::form::{json::Json as MultipartJson, tempfile::TempFile, MultipartForm};
use actix_web::{get, http::header, post, web, HttpResponse, Responder};
use chrono::NaiveDateTime;
use scoped_futures::ScopedFutureExt;
use serde::{Deserialize, Serialize};
use tokio::fs::File;
use tokio_util::io::ReaderStream;
use tracing::{instrument, warn};

use super::{
    auth::{MaybeSession, Session},
    util::choose_alternate,
    ApiErrorCode, ApiResult, AppState,
};
use crate::store::{
    metadata::ISO_FORMAT,
    models::{self, AlternateFileType, Location},
};
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
#[instrument(err, skip(app_state, session))]
async fn delete_media(
    app_state: web::Data<AppState>,
    session: Session,
    media_ids: web::Json<Vec<String>>,
) -> ApiResult<web::Json<ApiResponse>> {
    eprintln!("{media_ids:#?}");
    return Err(ApiErrorCode::NotImplemented);
}

#[derive(Default, Clone, Debug, Deserialize)]
#[serde(from = "Option<T>")]
enum MetadataValue<T> {
    #[default]
    Undefined,
    Null,
    Value(T),
}

impl<T> From<Option<T>> for MetadataValue<T> {
    fn from(opt: Option<T>) -> Self {
        match opt {
            Some(v) => Self::Value(v),
            None => Self::Null,
        }
    }
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct MediaMetadata {
    #[serde(default)]
    filename: MetadataValue<String>,
    #[serde(default)]
    title: MetadataValue<String>,
    #[serde(default)]
    description: MetadataValue<String>,
    #[serde(default)]
    label: MetadataValue<String>,
    #[serde(default)]
    category: MetadataValue<String>,
    #[serde(default)]
    location: MetadataValue<String>,
    #[serde(default)]
    city: MetadataValue<String>,
    #[serde(default)]
    state: MetadataValue<String>,
    #[serde(default)]
    country: MetadataValue<String>,
    #[serde(default)]
    make: MetadataValue<String>,
    #[serde(default)]
    model: MetadataValue<String>,
    #[serde(default)]
    lens: MetadataValue<String>,
    #[serde(default)]
    photographer: MetadataValue<String>,
    #[serde(default)]
    shutter_speed: MetadataValue<String>,
    #[serde(default)]
    orientation: MetadataValue<i32>,
    #[serde(default)]
    iso: MetadataValue<i32>,
    #[serde(default)]
    rating: MetadataValue<i32>,
    #[serde(default)]
    longitude: MetadataValue<f32>,
    #[serde(default)]
    latitude: MetadataValue<f32>,
    #[serde(default)]
    altitude: MetadataValue<f32>,
    #[serde(default)]
    aperture: MetadataValue<f32>,
    #[serde(default)]
    focal_length: MetadataValue<f32>,
    #[serde(default)]
    taken: MetadataValue<String>,
}

macro_rules! apply_metadata {
    ($source:ident, $target:ident, $field:ident) => {
        match $source.$field {
            MetadataValue::Undefined => (),
            MetadataValue::Null => $target.$field = None,
            MetadataValue::Value(ref v) => $target.$field = Some(v.clone()),
        }
    };
}

impl MediaMetadata {
    fn apply(&self, media_item: &mut models::MediaItem) {
        apply_metadata!(self, media_item, filename);
        apply_metadata!(self, media_item, title);
        apply_metadata!(self, media_item, description);
        apply_metadata!(self, media_item, label);
        apply_metadata!(self, media_item, category);
        apply_metadata!(self, media_item, location);
        apply_metadata!(self, media_item, city);
        apply_metadata!(self, media_item, state);
        apply_metadata!(self, media_item, country);
        apply_metadata!(self, media_item, make);
        apply_metadata!(self, media_item, model);
        apply_metadata!(self, media_item, lens);
        apply_metadata!(self, media_item, photographer);
        apply_metadata!(self, media_item, shutter_speed);
        apply_metadata!(self, media_item, orientation);
        apply_metadata!(self, media_item, iso);
        apply_metadata!(self, media_item, rating);
        apply_metadata!(self, media_item, longitude);
        apply_metadata!(self, media_item, latitude);
        apply_metadata!(self, media_item, altitude);
        apply_metadata!(self, media_item, aperture);
        apply_metadata!(self, media_item, focal_length);

        match self.taken {
            MetadataValue::Undefined => (),
            MetadataValue::Null => media_item.taken = None,
            MetadataValue::Value(ref v) => match NaiveDateTime::parse_and_remainder(&v, ISO_FORMAT)
            {
                Ok((dt, _)) => media_item.taken = Some(dt),
                Err(e) => warn!(date = v, "Invalid date format"),
            },
        }
    }
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
    #[serde(default)]
    tags: Vec<Vec<String>>,
    #[serde(default)]
    people: Vec<MediaPerson>,
}

#[derive(MultipartForm)]
struct MediaUpload {
    json: MultipartJson<MediaCreate>,
    file: TempFile,
}

#[derive(Serialize, Clone, Debug)]
struct MediaCreateResponse {
    id: String,
}

#[post("/api/media/create")]
#[instrument(err, skip_all)]
async fn create_media(
    app_state: web::Data<AppState>,
    session: Session,
    data: MultipartForm<MediaUpload>,
) -> ApiResult<web::Json<MediaCreateResponse>> {
    let data = data.into_inner();

    let response = app_state
        .store
        .in_transaction(|conn| {
            async move {
                let catalog =
                    models::Catalog::get_for_user(conn, &session.user.email, &data.json.catalog)
                        .await?;

                let mut media_item = models::MediaItem::new(&catalog.id);

                if let Some(ref metadata) = data.json.media {
                    metadata.apply(&mut media_item);
                }

                media_item.sync_with_file(None);

                let id = media_item.id.clone();

                models::MediaItem::upsert(conn, &[media_item.clone()]).await?;

                let mut tags = Vec::new();
                for tag_name in &data.json.tags {
                    tags.push(models::Tag::get_or_create(conn, &catalog.id, tag_name).await?);
                }

                media_item.add_tags(conn, &tags).await?;

                Ok(MediaCreateResponse { id })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(response))
}

#[derive(Deserialize, Clone, Debug)]
struct MediaUpdate {
    id: String,
    media: Option<MediaMetadata>,
    tags: Option<Vec<Vec<String>>>,
    people: Option<Vec<MediaPerson>>,
}

#[post("/api/media/edit")]
#[instrument(err, skip_all)]
async fn edit_media(
    app_state: web::Data<AppState>,
    session: Session,
    media: web::Json<MediaUpdate>,
) -> ApiResult<web::Json<ApiResponse>> {
    eprintln!("{media:#?}");
    return Err(ApiErrorCode::NotImplemented);
}
