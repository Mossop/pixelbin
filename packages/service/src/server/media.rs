use std::str::FromStr;

use actix_multipart::form::{json::Json as MultipartJson, tempfile::TempFile, MultipartForm};
use actix_web::{get, http::header, post, web, HttpResponse, Responder};
use chrono::NaiveDateTime;
use file_format::FileFormat;
use mime::Mime;
use scoped_futures::ScopedFutureExt;
use serde::{Deserialize, Serialize};
use tokio::fs::File;
use tokio_util::io::ReaderStream;
use tracing::{instrument, warn};

use crate::{
    metadata::ISO_FORMAT,
    server::{
        auth::{MaybeSession, Session},
        task_queue::Task,
        util::choose_alternate,
        ApiResult, AppState,
    },
    store::models::{self, AlternateFileType, Location},
    Error,
};

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

    let file_path = media_file_path.file(&file_name);
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
    let mimetype = Mime::from_str(&path.mimetype.replace('-', "/"))?;
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
    let mimetype = Mime::from_str(&path.mimetype.replace('-', "/"))?;
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

#[get("/media/{media_ids}")]
#[instrument(err, skip(app_state, session), fields(media))]
async fn get_media(
    app_state: web::Data<AppState>,
    session: Session,
    media_ids: web::Path<String>,
) -> ApiResult<web::Json<GetMediaResponse<models::MediaRelations>>> {
    tracing::Span::current().record("media", media_ids.as_str());
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

#[post("/media/delete")]
#[instrument(err, skip(app_state, session))]
async fn delete_media(
    app_state: web::Data<AppState>,
    session: Session,
    media_ids: web::Json<Vec<String>>,
) -> ApiResult<web::Json<ApiResponse>> {
    let media_ids = app_state
        .store
        .in_transaction(|conn| {
            async move {
                let mut media =
                    models::MediaItem::get_for_user(conn, &session.user.email, &media_ids).await?;

                media.iter_mut().for_each(|mi| mi.deleted = true);

                models::MediaItem::upsert(conn, &media).await?;

                Ok(media_ids)
            }
            .scope_boxed()
        })
        .await?;

    app_state
        .task_queue
        .queue_task(Task::DeleteMedia {
            media: media_ids.into_inner(),
        })
        .await;

    Ok(web::Json(ApiResponse {
        message: "Ok".to_string(),
    }))
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
    shutter_speed: MetadataValue<f32>,
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
            MetadataValue::Null => $target.metadata.$field = None,
            MetadataValue::Value(ref v) => $target.metadata.$field = Some(v.clone()),
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
            MetadataValue::Null => media_item.metadata.taken = None,
            MetadataValue::Value(ref v) => {
                match NaiveDateTime::parse_and_remainder(v, ISO_FORMAT) {
                    Ok((dt, _)) => media_item.metadata.taken = Some(dt),
                    Err(e) => warn!(date = v, error = ?e, "Invalid date format"),
                }
            }
        }
    }
}

#[derive(Deserialize, Clone, Debug)]
struct PersonInfo {
    name: String,
    location: Option<Location>,
}

#[derive(Deserialize, Clone, Debug)]
struct MediaUploadMetadata {
    id: Option<String>,
    catalog: Option<String>,
    media: Option<MediaMetadata>,
    tags: Option<Vec<Vec<String>>>,
    people: Option<Vec<PersonInfo>>,
}

#[derive(MultipartForm)]
struct MediaUpload {
    json: MultipartJson<MediaUploadMetadata>,
    file: TempFile,
}

#[derive(Serialize, Clone, Debug)]
struct MediaUploadResponse {
    id: String,
}

#[post("/media/upload")]
#[instrument(err, skip_all, fields(id, catalog))]
async fn upload_media(
    app_state: web::Data<AppState>,
    session: Session,
    data: MultipartForm<MediaUpload>,
) -> ApiResult<web::Json<MediaUploadResponse>> {
    let data = data.into_inner();

    tracing::Span::current().record("id", data.json.id.as_deref().unwrap_or_default());
    tracing::Span::current().record("catalog", data.json.catalog.as_deref().unwrap_or_default());

    let (media_item_id, media_file_id) = app_state
        .store
        .in_transaction(|conn| {
            async move {
                let mut media_item = match (&data.json.id, &data.json.catalog) {
                    (Some(id), None) => {
                        let mut media_items = models::MediaItem::get_for_user(
                            conn,
                            &session.user.email,
                            &[id.clone()],
                        )
                        .await?;

                        if media_items.is_empty() {
                            return Err(Error::NotFound);
                        }

                        media_items.remove(0)
                    }
                    (None, Some(catalog_id)) => {
                        let catalog =
                            models::Catalog::get_for_user(conn, &session.user.email, catalog_id)
                                .await?;
                        models::MediaItem::new(&catalog.id)
                    }
                    _ => {
                        return Err(Error::InvalidData {
                            message: "Need one of catalog or id".to_string(),
                        });
                    }
                };

                if let Some(ref metadata) = data.json.media {
                    metadata.apply(&mut media_item);
                }

                media_item.sync_with_file(None);

                models::MediaItem::upsert(conn, &[media_item.clone()]).await?;

                if let Some(ref tag_list) = data.json.tags {
                    let mut tags = Vec::new();
                    for tag_name in tag_list {
                        tags.push(
                            models::Tag::get_or_create(conn, &media_item.catalog, tag_name).await?,
                        );
                    }

                    media_item.replace_tags(conn, &tags).await?;
                }

                if let Some(ref person_list) = data.json.people {
                    let mut people: Vec<models::MediaPerson> = Vec::new();
                    for person_info in person_list {
                        let person = models::Person::get_or_create(
                            conn,
                            &media_item.catalog,
                            &person_info.name,
                        )
                        .await?;
                        people.push(models::MediaPerson {
                            catalog: media_item.catalog.clone(),
                            media: media_item.id.clone(),
                            person: person.id.clone(),
                            location: person_info.location.clone(),
                        });
                    }

                    models::MediaPerson::remove_for_media(conn, &media_item.id).await?;
                    models::MediaPerson::upsert(conn, &people).await?;
                }

                let base_name = if let Some(ref name) = data.file.file_name {
                    if let Some((name, _)) = name.rsplit_once('.') {
                        name
                    } else {
                        name
                    }
                } else {
                    "original"
                };

                let format = FileFormat::from_reader(data.file.file.as_file())?;
                let file_name = format!("{base_name}.{}", format.extension());

                let media_file = models::MediaFile::new(
                    &media_item.id,
                    &file_name,
                    data.file.size as i32,
                    &Mime::from_str(format.media_type())?,
                );

                let path = media_item
                    .path()
                    .media_file_path(&media_file.id)
                    .file(&file_name);

                conn.config()
                    .temp_store()
                    .copy_from_temp(data.file.file, &path)
                    .await?;

                let media_file_id = media_file.id.clone();
                models::MediaFile::upsert(conn, vec![media_file]).await?;

                Ok((media_item.id.clone(), media_file_id))
            }
            .scope_boxed()
        })
        .await?;

    app_state
        .task_queue
        .queue_task(Task::ProcessMediaFile {
            media_file: media_file_id,
        })
        .await;

    Ok(web::Json(MediaUploadResponse {
        id: media_item_id.clone(),
    }))
}
