use std::collections::HashSet;

use actix_web::{get, post, web};
use scoped_futures::ScopedFutureExt;
use serde::{Deserialize, Serialize};
use serde_with::{serde_as, OneOrMany};
use tracing::instrument;

use crate::{
    server::{
        auth::{MaybeSession, Session},
        media::{GetMediaRequest, GetMediaResponse},
        task_queue::Task,
        ApiResponse, ApiResult, AppState,
    },
    shared::short_id,
    store::{models, Isolation},
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
    let response = app_state
        .store
        .with_connection(|conn| {
            async move {
                let catalog = models::Catalog::get_for_user(
                    conn,
                    &session.user.email,
                    &request.catalog,
                    true,
                )
                .await?;

                let album = models::Album {
                    id: short_id("A"),
                    catalog: catalog.id.clone(),
                    name: request.album.name.clone(),
                    parent: request.album.parent.clone(),
                };

                models::Album::upsert(conn, &[album.clone()]).await?;

                Ok(album)
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(response))
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
    let album = app_state
        .store
        .isolated(Isolation::Committed, |conn| {
            async move {
                let mut album =
                    models::Album::get_for_user_for_update(conn, &session.user.email, &request.id)
                        .await?;

                album.name = request.album.name.clone();
                album.parent = request.album.parent.clone();

                models::Album::upsert(conn, &[album.clone()]).await?;

                Ok(album)
            }
            .scope_boxed()
        })
        .await?;

    app_state
        .task_queue
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
    let catalogs = app_state
        .store
        .isolated(Isolation::Committed, |conn| {
            async move {
                let mut ids: Vec<String> = Vec::new();
                let mut catalogs: HashSet<String> = HashSet::new();

                for id in albums.iter() {
                    let album =
                        models::Album::get_for_user_for_update(conn, &session.user.email, id)
                            .await?;
                    catalogs.insert(album.catalog);
                    ids.push(album.id);
                }

                models::Album::delete(conn, &ids).await?;

                Ok(catalogs)
            }
            .scope_boxed()
        })
        .await?;

    for catalog in catalogs {
        app_state
            .task_queue
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
    let catalogs = app_state
        .store
        .isolated(Isolation::Committed, |conn| {
            async move {
                let mut catalogs: HashSet<String> = HashSet::new();

                for update in updates.into_inner() {
                    let album = models::Album::get_for_user_for_update(
                        conn,
                        &session.user.email,
                        &update.album,
                    )
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

                            models::MediaAlbum::upsert(conn, &media_albums).await?;
                        }
                        RelationOperation::Delete => {
                            models::MediaAlbum::remove_media(conn, &album.id, &update.media)
                                .await?;
                        }
                    }
                }

                Ok(catalogs)
            }
            .scope_boxed()
        })
        .await?;

    for catalog in catalogs {
        app_state
            .task_queue
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

#[derive(Serialize)]
struct AlbumResponse {
    #[serde(flatten)]
    album: models::Album,
    media: i64,
}

#[get("/album/{album_id}")]
#[instrument(err, skip(app_state, session))]
async fn get_album(
    app_state: web::Data<AppState>,
    session: Session,
    album_id: web::Path<String>,
    query: web::Query<AlbumListRequest>,
) -> ApiResult<web::Json<AlbumResponse>> {
    let response = app_state
        .store
        .with_connection(|conn| {
            async move {
                let (album, media) = models::Album::get_for_user_with_count(
                    conn,
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

#[get("/search/{search_id}")]
#[instrument(err, skip(app_state, session))]
async fn get_search(
    app_state: web::Data<AppState>,
    session: MaybeSession,
    search_id: web::Path<String>,
) -> ApiResult<web::Json<SearchResponse>> {
    let email = session.session().map(|s| s.user.email.as_str());

    let response = app_state
        .store
        .with_connection(|conn| {
            async move {
                let (search, media) =
                    models::SavedSearch::get_for_user_with_count(conn, email, &search_id).await?;

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

#[get("/catalog/{catalog_id}")]
#[instrument(err, skip(app_state, session))]
async fn get_catalog(
    app_state: web::Data<AppState>,
    session: Session,
    catalog_id: web::Path<String>,
) -> ApiResult<web::Json<CatalogResponse>> {
    let response = app_state
        .store
        .with_connection(|conn| {
            async move {
                let (catalog, media) = models::Catalog::get_for_user_with_count(
                    conn,
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

#[get("/catalog/{catalog_id}/media")]
#[instrument(err, skip(app_state, session))]
async fn get_catalog_media(
    app_state: web::Data<AppState>,
    session: Session,
    catalog_id: web::Path<String>,
    query: web::Query<GetMediaRequest>,
) -> ApiResult<web::Json<GetMediaResponse<models::MediaView>>> {
    let response = app_state
        .store
        .isolated(Isolation::ReadOnly, |conn| {
            async move {
                let (catalog, media_count) = models::Catalog::get_for_user_with_count(
                    conn,
                    &session.user.email,
                    &catalog_id,
                )
                .await?;
                let media = catalog.list_media(conn, query.offset, query.count).await?;

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

#[get("/album/{album_id}/media")]
#[instrument(err, skip(app_state, session))]
async fn get_album_media(
    app_state: web::Data<AppState>,
    session: Session,
    album_id: web::Path<String>,
    query: web::Query<GetRecursiveMediaRequest>,
) -> ApiResult<web::Json<GetMediaResponse<models::MediaView>>> {
    let response = app_state
        .store
        .isolated(Isolation::ReadOnly, |conn| {
            async move {
                let (album, media_count) = models::Album::get_for_user_with_count(
                    conn,
                    &session.user.email,
                    &album_id,
                    query.recursive,
                )
                .await?;
                let media = album
                    .list_media(conn, query.recursive, query.offset, query.count)
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

#[get("/search/{search_id}/media")]
#[instrument(err, skip(app_state, session))]
async fn get_search_media(
    app_state: web::Data<AppState>,
    session: MaybeSession,
    search_id: web::Path<String>,
    query: web::Query<GetMediaRequest>,
) -> ApiResult<web::Json<GetMediaResponse<models::MediaView>>> {
    let email = session.session().map(|s| s.user.email.as_str());

    let response = app_state
        .store
        .isolated(Isolation::ReadOnly, |conn| {
            async move {
                let (search, media_count) =
                    models::SavedSearch::get_for_user_with_count(conn, email, &search_id).await?;
                let media = search.list_media(conn, query.offset, query.count).await?;

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
