use std::collections::HashSet;

use actix_web::{
    get,
    http::{header, StatusCode},
    post,
    web::{self},
    HttpResponse, HttpResponseBuilder,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_with::{serde_as, OneOrMany};
use tracing::instrument;

use crate::{
    server::{
        auth::{MaybeSession, Session},
        ApiResponse, ApiResult, AppState,
    },
    shared::short_id,
    store::{
        db::Isolation,
        models::{
            self, AlbumWithCount, MediaViewStream, SavedSearchWithCount, SourceType,
            UserCatalogWithCount,
        },
    },
    Task,
};

#[derive(Deserialize, Clone, Debug)]
struct AlbumDetail {
    name: String,
    parent: Option<String>,
}

#[derive(Deserialize, Clone, Debug)]
struct CreateAlbumRequest {
    catalog: String,
    album: AlbumDetail,
}

#[post("/album/create")]
#[instrument(err, skip(app_state, session, request))]
async fn create_album(
    app_state: web::Data<AppState>,
    session: Session,
    request: web::Json<CreateAlbumRequest>,
) -> ApiResult<web::Json<models::Album>> {
    let mut conn = app_state.store.connect().await?;
    let user_catalog =
        models::Catalog::get_for_user(&mut conn, &session.user.email, &request.catalog, true)
            .await?;

    let album = models::Album {
        id: short_id("A"),
        catalog: user_catalog.catalog.id.clone(),
        name: request.album.name.clone(),
        parent: request.album.parent.clone(),
    };

    models::Album::upsert(&mut conn, &[album.clone()]).await?;

    Ok(web::Json(album))
}

#[derive(Deserialize, Clone, Debug)]
struct EditAlbumRequest {
    id: String,
    album: AlbumDetail,
}

#[post("/album/edit")]
#[instrument(err, skip(app_state, session, request))]
async fn edit_album(
    app_state: web::Data<AppState>,
    session: Session,
    request: web::Json<EditAlbumRequest>,
) -> ApiResult<web::Json<models::Album>> {
    let mut conn = app_state.store.isolated(Isolation::Committed).await?;
    let mut album =
        models::Album::get_writable_for_user(&mut conn, &session.user.email, &request.id).await?;

    album.name.clone_from(&request.album.name);
    album.parent.clone_from(&request.album.parent);

    models::Album::upsert(&mut conn, &[album.clone()]).await?;
    conn.commit().await?;

    app_state
        .store
        .queue_task(Task::UpdateSearches {
            catalog: album.catalog.clone(),
        })
        .await;

    Ok(web::Json(album))
}

#[post("/album/delete")]
#[instrument(err, skip(app_state, session, albums))]
async fn delete_album(
    app_state: web::Data<AppState>,
    session: Session,
    albums: web::Json<Vec<String>>,
) -> ApiResult<web::Json<ApiResponse>> {
    let mut conn = app_state.store.isolated(Isolation::Committed).await?;
    let mut ids: Vec<String> = Vec::new();
    let mut catalogs: HashSet<String> = HashSet::new();

    for id in albums.iter() {
        let album =
            models::Album::get_writable_for_user(&mut conn, &session.user.email, id).await?;
        catalogs.insert(album.catalog);
        ids.push(album.id);
    }

    models::Album::delete(&mut conn, &ids).await?;
    conn.commit().await?;

    for catalog in catalogs {
        app_state
            .store
            .queue_task(Task::UpdateSearches { catalog })
            .await;
    }

    Ok(web::Json(Default::default()))
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
enum RelationOperation {
    Add,
    Delete,
}

#[serde_as]
#[derive(Deserialize, Clone, Debug)]
struct AlbumMediaChange {
    operation: RelationOperation,
    #[serde_as(deserialize_as = "OneOrMany<_>")]
    media: Vec<String>,
    album: String,
}

#[post("/album/media")]
#[instrument(err, skip(app_state, session, updates))]
async fn album_media_change(
    app_state: web::Data<AppState>,
    session: Session,
    updates: web::Json<Vec<AlbumMediaChange>>,
) -> ApiResult<web::Json<ApiResponse>> {
    let mut conn = app_state.store.isolated(Isolation::Committed).await?;
    let mut catalogs: HashSet<String> = HashSet::new();

    for update in updates.into_inner() {
        let album =
            models::Album::get_writable_for_user(&mut conn, &session.user.email, &update.album)
                .await?;

        catalogs.insert(album.catalog.clone());

        match update.operation {
            RelationOperation::Add => {
                let media_albums: Vec<models::MediaAlbum> = update
                    .media
                    .into_iter()
                    .map(|m| models::MediaAlbum {
                        catalog: album.catalog.clone(),
                        album: album.id.clone(),
                        media: m,
                    })
                    .collect();

                models::MediaAlbum::upsert(&mut conn, &media_albums).await?;
            }
            RelationOperation::Delete => {
                models::MediaAlbum::remove_media(&mut conn, &album.id, &update.media).await?;
            }
        }
    }
    conn.commit().await?;

    for catalog in catalogs {
        app_state
            .store
            .queue_task(Task::UpdateSearches { catalog })
            .await;
    }

    return Ok(web::Json(ApiResponse::default()));
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize)]
struct AlbumListRequest {
    #[serde(default = "default_true")]
    recursive: bool,
}

#[get("/album/{album_id}")]
#[instrument(err, skip(app_state, session))]
async fn get_album(
    app_state: web::Data<AppState>,
    session: Session,
    album_id: web::Path<String>,
    query: web::Query<AlbumListRequest>,
) -> ApiResult<web::Json<AlbumWithCount>> {
    let mut conn = app_state.store.connect().await?;
    let album = models::Album::get_for_user_with_count(
        &mut conn,
        &session.user.email,
        &album_id,
        query.recursive,
    )
    .await?;

    Ok(web::Json(album))
}

#[get("/search/{search_id}")]
#[instrument(err, skip(app_state, session))]
async fn get_search(
    app_state: web::Data<AppState>,
    session: MaybeSession,
    search_id: web::Path<String>,
) -> ApiResult<web::Json<SavedSearchWithCount>> {
    let email = session.session().map(|s| s.user.email.as_str());

    let mut conn = app_state.store.connect().await?;
    let search = models::SavedSearch::get_for_user_with_count(&mut conn, email, &search_id).await?;

    Ok(web::Json(search))
}

#[get("/catalog/{catalog_id}")]
#[instrument(err, skip(app_state, session))]
async fn get_catalog(
    app_state: web::Data<AppState>,
    session: Session,
    catalog_id: web::Path<String>,
) -> ApiResult<web::Json<UserCatalogWithCount>> {
    let mut conn = app_state.store.connect().await?;
    let user_catalog =
        models::Catalog::get_for_user_with_count(&mut conn, &session.user.email, &catalog_id)
            .await?;

    Ok(web::Json(user_catalog))
}

#[get("/catalog/{catalog_id}/media")]
#[instrument(err, skip(app_state, session))]
async fn get_catalog_media(
    app_state: web::Data<AppState>,
    session: Session,
    catalog_id: web::Path<String>,
) -> ApiResult<HttpResponse> {
    let mut conn = app_state.store.connect().await?;
    let user_catalog =
        models::Catalog::get_for_user(&mut conn, &session.user.email, &catalog_id, false).await?;

    let (stream, sender) = MediaViewStream::new();

    tokio::spawn(user_catalog.catalog.stream_media(conn, sender));

    Ok(HttpResponseBuilder::new(StatusCode::OK)
        .append_header((header::CONTENT_TYPE, "application/x-ndjson"))
        .streaming(stream))
}

#[derive(Debug, Deserialize)]
struct GetRecursiveMediaRequest {
    #[serde(default = "default_true")]
    recursive: bool,
}

#[get("/album/{album_id}/media")]
#[instrument(err, skip(app_state, session))]
async fn get_album_media(
    app_state: web::Data<AppState>,
    session: Session,
    album_id: web::Path<String>,
    query: web::Query<GetRecursiveMediaRequest>,
) -> ApiResult<HttpResponse> {
    let mut conn = app_state.store.connect().await?;
    let album = models::Album::get_for_user(&mut conn, &session.user.email, &album_id).await?;

    let (stream, sender) = MediaViewStream::new();

    tokio::spawn(album.stream_media(conn, query.recursive, sender));

    Ok(HttpResponseBuilder::new(StatusCode::OK)
        .append_header((header::CONTENT_TYPE, "application/x-ndjson"))
        .streaming(stream))
}

#[derive(Deserialize, Debug)]
struct MediaOptions {
    since: Option<DateTime<Utc>>,
}

#[get("/search/{search_id}/media")]
#[instrument(err, skip(app_state, session))]
async fn get_search_media(
    app_state: web::Data<AppState>,
    session: MaybeSession,
    search_id: web::Path<String>,
    options: web::Query<MediaOptions>,
) -> ApiResult<HttpResponse> {
    let email = session.session().map(|s| s.user.email.as_str());

    let mut conn = app_state.store.connect().await?;
    let search = models::SavedSearch::get_for_user(&mut conn, email, &search_id).await?;

    let (stream, sender) = MediaViewStream::new();

    tokio::spawn(search.stream_media(conn, options.since, sender));

    Ok(HttpResponseBuilder::new(StatusCode::OK)
        .append_header((header::CONTENT_TYPE, "application/x-ndjson"))
        .streaming(stream))
}

#[derive(Debug, Deserialize)]
struct SubscribeRequest {
    search: String,
    email: String,
}

#[post("/subscribe")]
#[instrument(err, skip(app_state))]
async fn subscribe(
    app_state: web::Data<AppState>,
    request: web::Json<SubscribeRequest>,
) -> ApiResult<web::Json<ApiResponse>> {
    let mut conn = app_state.store.connect().await?;
    let search =
        models::SavedSearch::get_for_user(&mut conn, Some(&request.email), &request.search).await?;

    tokio::spawn(search.subscribe(conn, request.email.clone()));

    Ok(web::Json(Default::default()))
}

#[derive(Debug, Deserialize)]
struct VerifyRequest {
    token: String,
}

#[post("/verify")]
#[instrument(err, skip(app_state))]
async fn verify_subscription(
    app_state: web::Data<AppState>,
    request: web::Json<VerifyRequest>,
) -> ApiResult<web::Json<ApiResponse>> {
    let conn = app_state.store.connect().await?;

    tokio::spawn(models::SavedSearch::confirm_subscription(
        conn,
        request.token.clone(),
    ));

    Ok(web::Json(Default::default()))
}

#[derive(Debug, Deserialize)]
struct UnsubscribeRequest {
    email: String,
    search: Option<String>,
}

#[post("/unsubscribe")]
#[instrument(err, skip(app_state))]
async fn unsubscribe(
    app_state: web::Data<AppState>,
    request: web::Json<UnsubscribeRequest>,
) -> ApiResult<web::Json<ApiResponse>> {
    let mut conn = app_state.store.connect().await?;

    models::SavedSearch::unsubscribe(&mut conn, &request.email, request.search.as_deref()).await?;

    Ok(web::Json(Default::default()))
}

#[derive(Deserialize)]
struct SourceRequest {
    id: Option<String>,
    name: String,
    #[serde(rename = "type")]
    source_type: SourceType,
}

#[post("/source")]
#[instrument(err, skip(app_state, request, _session))]
async fn set_source(
    app_state: web::Data<AppState>,
    request: web::Json<SourceRequest>,
    _session: Session,
) -> ApiResult<web::Json<models::Source>> {
    let source = models::Source {
        id: request.id.clone().unwrap_or_else(|| short_id("U")),
        name: request.name.clone(),
        source_type: request.source_type,
    };

    match source.create_or_update(&mut app_state.store.pooled()).await {
        Ok(_) => Ok(web::Json(source)),
        Err(e) => Err(e.into()),
    }
}

#[get("/source/{id}")]
#[instrument(err, skip(app_state, _session))]
async fn list_source(
    app_state: web::Data<AppState>,
    source_id: web::Path<String>,
    _session: Session,
) -> ApiResult<web::Json<Vec<String>>> {
    let media = models::Source::list_media(&mut app_state.store.pooled(), &source_id).await?;
    Ok(web::Json(media))
}
