use actix_web::{post, web};
use serde::Deserialize;
use serde_with::{serde_as, OneOrMany};
use tracing::instrument;

use crate::{
    server::{auth::Session, ApiResult, AppState},
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
