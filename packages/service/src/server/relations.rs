use actix_web::{get, post, web};
use scoped_futures::ScopedFutureExt;
use serde::{Deserialize, Serialize};
use serde_with::{serde_as, OneOrMany};
use tracing::instrument;

use super::{auth::Session, ApiResult, AppState};
use crate::{
    server::media::{GetMediaRequest, GetMediaResponse},
    store::models,
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

#[post("/api/album/create")]
#[instrument(err, skip(app_state, session, request))]
async fn create_album(
    app_state: web::Data<AppState>,
    session: Session,
    request: web::Json<CreateAlbumRequest>,
) -> ApiResult<web::Json<models::Album>> {
    eprintln!("{request:#?}");
    todo!();
}

#[derive(Deserialize, Clone, Debug)]
struct EditAlbumRequest {
    id: String,
    album: AlbumDetail,
}

#[post("/api/album/edit")]
#[instrument(err, skip(app_state, session, request))]
async fn edit_album(
    app_state: web::Data<AppState>,
    session: Session,
    request: web::Json<EditAlbumRequest>,
) -> ApiResult<web::Json<models::Album>> {
    eprintln!("{request:#?}");
    todo!();
}

#[post("/api/album/delete")]
#[instrument(err, skip(app_state, session, albums))]
async fn delete_album(
    app_state: web::Data<AppState>,
    session: Session,
    albums: web::Json<Vec<String>>,
) -> ApiResult<web::Json<models::Album>> {
    eprintln!("{albums:#?}");
    todo!();
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
enum RelationOperation {
    Add,
    Delete,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
enum RelationType {
    Album,
    Tag,
    Person,
}

#[serde_as]
#[derive(Deserialize, Clone, Debug)]
struct RelationChange {
    operation: RelationOperation,
    #[serde(rename = "type")]
    relation: RelationType,
    #[serde_as(deserialize_as = "OneOrMany<_>")]
    media: Vec<String>,
    #[serde_as(deserialize_as = "OneOrMany<_>")]
    items: Vec<String>,
}

#[post("/api/media/relations")]
#[instrument(err, skip(app_state, session, updates))]
async fn update_relations(
    app_state: web::Data<AppState>,
    session: Session,
    updates: web::Json<Vec<RelationChange>>,
) -> ApiResult<web::Json<models::Album>> {
    eprintln!("{updates:#?}");
    todo!();
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
        .in_transaction(|conn| {
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

#[get("/api/search/{search_id}")]
#[instrument(err, skip(app_state, session))]
async fn get_search(
    app_state: web::Data<AppState>,
    session: Session,
    search_id: web::Path<String>,
) -> ApiResult<web::Json<SearchResponse>> {
    let response = app_state
        .store
        .in_transaction(|conn| {
            async move {
                let (search, media) = models::SavedSearch::get_for_user_with_count(
                    conn,
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
        .in_transaction(|conn| {
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
        .in_transaction(|conn| {
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
        .in_transaction(|conn| {
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
        .in_transaction(|conn| {
            async move {
                let (search, media_count) = models::SavedSearch::get_for_user_with_count(
                    conn,
                    &session.user.email,
                    &search_id,
                )
                .await?;
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
