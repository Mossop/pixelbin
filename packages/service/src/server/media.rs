use std::str::FromStr;

use actix_multipart::form::{json::Json as MultipartJson, tempfile::TempFile, MultipartForm};
use actix_web::{
    get,
    http::{header, StatusCode},
    post, web, Either, HttpRequest, HttpResponse, HttpResponseBuilder, Responder,
};
use chrono::NaiveDateTime;
use file_format::FileFormat;
use mime::Mime;
use serde::{Deserialize, Serialize};
use tokio::fs::File;
use tokio_util::io::ReaderStream;
use tracing::{instrument, warn};

use crate::{
    metadata::{alternates_for_media_file, ISO_FORMAT},
    server::{
        auth::{MaybeSession, Session},
        util::choose_alternate,
        ApiResponse, ApiResult, AppState,
    },
    store::{
        db::Isolation,
        db::{search::SearchQuery, DbConnection},
        file::DiskStore,
        models::{self, AlternateFile, AlternateFileType, Location, MediaViewStream, Orientation},
    },
    Error, Result, Task,
};

fn not_found() -> ApiResult<HttpResponse> {
    Ok(HttpResponse::NotFound()
        .content_type("text/plain")
        .body("Not Found"))
}

#[derive(Debug, Deserialize)]
struct SocialPath {
    item: String,
}

#[get("/{item}/social")]
#[instrument(err, skip(app_state))]
async fn social_handler(
    app_state: web::Data<AppState>,
    path: web::Path<SocialPath>,
) -> ApiResult<impl Responder> {
    let (alternate, path) =
        match models::AlternateFile::get_social(app_state.store.clone(), &path.item).await {
            Ok(alternates) => alternates,
            Err(Error::NotFound) => return not_found(),
            Err(e) => return Err(e.into()),
        };

    let path = DiskStore::local_store(app_state.store.config()).local_path(&path);
    let file = File::open(&path).await?;
    let stream = ReaderStream::new(file);

    Ok(HttpResponse::Ok()
        .content_type(alternate.mimetype.clone())
        .append_header((header::CONTENT_LENGTH, alternate.file_size))
        .streaming(stream))
}

#[derive(Debug, Deserialize)]
struct DownloadPath {
    item: String,
    file: String,
    filename: String,
}

#[get("/download/{item}/{file}/{filename}")]
#[instrument(err, skip(app_state, session))]
async fn download_handler(
    app_state: web::Data<AppState>,
    session: MaybeSession,
    path: web::Path<DownloadPath>,
) -> ApiResult<impl Responder> {
    let email = session.session().map(|s| s.user.email.as_str());
    let filename = path.filename.clone();

    let mut conn = app_state.store.connect().await?;
    let (media_file, media_file_store) =
        models::MediaFile::get_for_user_media(&mut conn, email, &path.item, &path.file).await?;

    let storage = models::Storage::get_for_catalog(&mut conn, &media_file_store.catalog).await?;

    let file_path = media_file_store.file(&media_file.file_name);
    let uri = storage
        .online_uri(
            &file_path,
            &media_file.mimetype,
            Some(&filename),
            app_state.store.config(),
        )
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

#[get("/thumb/{item}/{file}/{size}/{mimetype}/{_filename}")]
#[instrument(err, skip(app_state, session))]
async fn thumbnail_handler(
    app_state: web::Data<AppState>,
    session: MaybeSession,
    path: web::Path<ThumbnailPath>,
) -> ApiResult<impl Responder> {
    let email = session.session().map(|s| s.user.email.as_str());
    let mimetype = Mime::from_str(&path.mimetype.replace('-', "/"))?;
    let target_size = path.size as i32;

    let mut conn = app_state.store.connect().await?;
    let alternates = models::AlternateFile::list_for_user_media(
        &mut conn,
        email,
        &path.item,
        &path.file,
        &mimetype,
        AlternateFileType::Thumbnail,
    )
    .await?;

    match choose_alternate(alternates, target_size) {
        Some((alternate, file_path)) => {
            let path = DiskStore::local_store(app_state.store.config()).local_path(&file_path);
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

#[derive(Serialize)]
struct EncodingResponse {
    url: String,
}

#[get("/encoding/{item}/{file}/{mimetype}/{_filename}")]
#[instrument(err, skip(app_state, session))]
async fn encoding_handler(
    app_state: web::Data<AppState>,
    session: MaybeSession,
    request: HttpRequest,
    path: web::Path<EncodingPath>,
) -> ApiResult<Either<HttpResponse, web::Json<EncodingResponse>>> {
    let email = session.session().map(|s| s.user.email.as_str());
    let mimetype = Mime::from_str(&path.mimetype.replace('-', "/"))?;
    let tx_mime = mimetype.clone();

    let mut conn = app_state.store.connect().await?;

    let (_, file_path) = models::AlternateFile::list_for_user_media(
        &mut conn,
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

    let storage = models::Storage::get_for_catalog(&mut conn, &file_path.catalog).await?;

    let url = storage
        .online_uri(&file_path, &mimetype, None, app_state.store.config())
        .await?;

    if let Some(val) = request.headers().get("Accept") {
        if val == "application/json" {
            return Ok(Either::Right(web::Json(EncodingResponse { url })));
        }
    }

    Ok(Either::Left(
        HttpResponse::TemporaryRedirect()
            .append_header(("Location", url))
            .finish(),
    ))
}

#[derive(Debug, Deserialize)]
struct MediaRequest {
    #[serde(default)]
    search: Option<String>,
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
    session: MaybeSession,
    request: web::Query<MediaRequest>,
    media_ids: web::Path<String>,
) -> ApiResult<web::Json<GetMediaResponse<models::MediaRelations>>> {
    tracing::Span::current().record("media", media_ids.as_str());
    let ids: Vec<String> = media_ids.split(',').map(|s| s.to_owned()).collect();
    let email = session.session().map(|s| s.user.email.as_str());

    let mut conn = app_state.store.connect().await?;
    let media =
        models::MediaRelations::get_for_user(&mut conn, email, request.search.as_deref(), &ids)
            .await?;

    let response = GetMediaResponse {
        total: media.len() as i64,
        media,
    };

    Ok(web::Json(response))
}

#[post("/media/delete")]
#[instrument(err, skip(app_state, session))]
async fn delete_media(
    app_state: web::Data<AppState>,
    session: Session,
    media_ids: web::Json<Vec<String>>,
) -> ApiResult<web::Json<ApiResponse>> {
    let mut conn = app_state.store.isolated(Isolation::Committed).await?;
    let media = models::MediaItem::get_for_user(&mut conn, &session.user.email, &media_ids).await?;

    let media_ids: Vec<String> = media.into_iter().map(|m| m.id).collect();

    models::MediaItem::mark_deleted(&mut conn, &media_ids).await?;
    conn.commit().await?;

    Ok(web::Json(ApiResponse::default()))
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
    orientation: MetadataValue<Orientation>,
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
struct MediaData {
    media: Option<MediaMetadata>,
    tags: Option<Vec<Vec<String>>>,
    people: Option<Vec<PersonInfo>>,
    public: Option<bool>,
}

#[derive(Deserialize, Clone, Debug)]
struct MediaCreateMetadata {
    catalog: String,
    #[serde(flatten)]
    metadata: MediaData,
}

#[derive(Deserialize, Clone, Debug)]
struct MediaUploadMetadata {
    id: String,
    #[serde(flatten)]
    metadata: MediaData,
}

#[derive(Serialize, Clone, Debug)]
struct MediaUploadResponse {
    id: String,
}

async fn update_media_item(
    conn: &mut DbConnection<'_>,
    media_item: &mut models::MediaItem,
    data: &MediaData,
) -> Result {
    if let Some(ref metadata) = data.media {
        metadata.apply(media_item);
    }

    let media_file = if let Some(ref media_file) = media_item.media_file {
        let (media_file, _) = models::MediaFile::get(conn, media_file).await?;
        Some(media_file)
    } else {
        None
    };

    media_item.sync_with_file(media_file.as_ref());

    if let Some(public) = data.public {
        if media_item.public != public {
            media_item.public = public;

            if let Some(file) = media_file {
                let file_id = file.id.clone();
                let media_file_store = media_item.path().media_file_store(&file.id);
                let alternates = alternates_for_media_file(conn.config(), &file, public);
                models::AlternateFile::sync_for_media_files(
                    conn,
                    vec![(file, media_file_store, alternates)],
                )
                .await?;

                conn.queue_task(Task::ProcessMediaFile {
                    media_file: file_id,
                })
                .await;
            }
        }
    }

    models::MediaItem::upsert(conn, &[media_item.clone()]).await?;

    if let Some(ref tag_list) = data.tags {
        let mut tags = Vec::new();
        for tag_name in tag_list {
            let tag =
                models::Tag::get_or_create_hierarchy(conn, &media_item.catalog, tag_name).await?;
            tags.push(models::MediaTag {
                catalog: media_item.catalog.clone(),
                tag: tag.id,
                media: media_item.id.clone(),
            });
        }

        models::MediaTag::replace_for_media(conn, &media_item.id, &tags).await?;
    }

    if let Some(ref person_list) = data.people {
        let mut people: Vec<models::MediaPerson> = Vec::new();
        for person_info in person_list {
            let person =
                models::Person::get_or_create(conn, &media_item.catalog, &person_info.name).await?;
            people.push(models::MediaPerson {
                catalog: media_item.catalog.clone(),
                media: media_item.id.clone(),
                person: person.id.clone(),
                location: person_info.location,
            });
        }

        models::MediaPerson::replace_for_media(conn, &media_item.id, &people).await?;
    }

    Ok(())
}

#[post("/media/create")]
#[instrument(err, skip_all, fields(catalog))]
async fn create_media(
    app_state: web::Data<AppState>,
    session: Session,
    data: web::Json<MediaCreateMetadata>,
) -> ApiResult<web::Json<MediaUploadResponse>> {
    tracing::Span::current().record("catalog", &data.catalog);

    let mut conn = app_state.store.isolated(Isolation::Committed).await?;
    let user_catalog =
        models::Catalog::get_for_user(&mut conn, &session.user.email, &data.catalog, true).await?;
    let mut media_item = models::MediaItem::new(&user_catalog.catalog.id);

    update_media_item(&mut conn, &mut media_item, &data.metadata).await?;
    conn.commit().await?;

    Ok(web::Json(MediaUploadResponse { id: media_item.id }))
}

#[derive(MultipartForm)]
struct MediaUpload {
    json: MultipartJson<MediaUploadMetadata>,
    file: TempFile,
}

#[post("/media/upload")]
#[instrument(err, skip_all, fields(id, catalog))]
async fn upload_media(
    app_state: web::Data<AppState>,
    session: Session,
    data: MultipartForm<MediaUpload>,
) -> ApiResult<web::Json<MediaUploadResponse>> {
    let data = data.into_inner();

    tracing::Span::current().record("id", &data.json.id);

    let mut conn = app_state.store.isolated(Isolation::Committed).await?;
    let mut media_items =
        models::MediaItem::get_for_user(&mut conn, &session.user.email, &[data.json.id.clone()])
            .await?;

    if media_items.is_empty() {
        return Err(Error::NotFound.into());
    }

    let mut media_item = media_items.remove(0);

    if media_item.deleted {
        return Err(Error::NotFound.into());
    }

    update_media_item(&mut conn, &mut media_item, &data.json.metadata).await?;

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
    let media_type: Mime = format.media_type().parse()?;
    if !matches!(media_type.type_(), mime::IMAGE | mime::VIDEO) {
        return Err(Error::UnsupportedMedia { mime: media_type }.into());
    }

    let file_name = format!("{base_name}.{}", format.extension());

    let media_file = models::MediaFile::new(
        &media_item.id,
        &file_name,
        data.file.size as i64,
        &Mime::from_str(format.media_type())?,
    );

    let path = media_item
        .path()
        .media_file_store(&media_file.id)
        .file(&file_name);

    DiskStore::temp_store(conn.config())
        .copy_from_temp(data.file.file.into_temp_path(), &path)
        .await?;

    let alternate_files: Vec<AlternateFile> =
        alternates_for_media_file(conn.config(), &media_file, false)
            .into_iter()
            .map(|a| AlternateFile::new(&media_file.id, a))
            .collect();

    let media_file_id = media_file.id.clone();

    models::MediaFile::upsert(&mut conn, vec![media_file]).await?;
    models::AlternateFile::upsert(&mut conn, alternate_files).await?;
    conn.commit().await?;

    app_state
        .store
        .queue_task(Task::ProcessMediaFile {
            media_file: media_file_id,
        })
        .await;

    Ok(web::Json(MediaUploadResponse { id: media_item.id }))
}

#[post("/media/edit")]
#[instrument(err, skip_all, fields(id))]
async fn edit_media(
    app_state: web::Data<AppState>,
    session: Session,
    data: web::Json<MediaUploadMetadata>,
) -> ApiResult<web::Json<ApiResponse>> {
    tracing::Span::current().record("id", &data.id);

    let mut conn = app_state.store.isolated(Isolation::Committed).await?;
    let mut media =
        models::MediaItem::get_for_user(&mut conn, &session.user.email, &[data.id.clone()]).await?;

    if media.is_empty() {
        return Err(Error::NotFound.into());
    }

    let mut media_item = media.remove(0);
    if media_item.deleted {
        return Err(Error::NotFound.into());
    }

    update_media_item(&mut conn, &mut media_item, &data.metadata).await?;
    conn.commit().await?;

    app_state
        .store
        .queue_task(Task::UpdateSearches {
            catalog: media_item.catalog,
        })
        .await;

    Ok(web::Json(Default::default()))
}

#[derive(Deserialize, Debug)]
struct SearchRequest {
    catalog: String,
    query: SearchQuery,
}

#[post("/search")]
#[instrument(err, skip_all)]
async fn search_media(
    app_state: web::Data<AppState>,
    session: Session,
    data: web::Json<SearchRequest>,
) -> ApiResult<HttpResponse> {
    let mut conn = app_state.store.connect().await?;
    let user_catalog =
        models::Catalog::get_for_user(&mut conn, &session.user.email, &data.catalog, false).await?;

    let (stream, sender) = MediaViewStream::new();

    let query = data.query.clone();
    tokio::spawn(query.stream_media(conn, user_catalog.catalog.id.clone(), sender));

    Ok(HttpResponseBuilder::new(StatusCode::OK)
        .append_header((header::CONTENT_TYPE, "application/x-ndjson"))
        .streaming(stream))
}
