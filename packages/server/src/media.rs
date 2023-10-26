use actix_web::{get, web};
use pixelbin_store::{models, DbQueries};
use scoped_futures::ScopedFutureExt;
use serde::{Deserialize, Serialize};
use serde_with::serde_as;
use tracing::instrument;

use crate::{auth::Session, ApiResult, AppState};

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
struct AlbumListResponse {
    #[serde(flatten)]
    album: models::Album,
    media: Vec<models::MediaView>,
}

#[get("/api/album/{album_id}")]
#[instrument(skip(app_state, session))]
async fn album_list(
    app_state: web::Data<AppState>,
    session: Session,
    album_id: web::Path<String>,
    query: web::Query<AlbumListRequest>,
) -> ApiResult<web::Json<AlbumListResponse>> {
    let response = app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let album = trx.get_user_album(&session.email, &album_id).await?;
                let media = trx.list_album_media(&album, query.recursive).await?;

                Ok(AlbumListResponse { album, media })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(response))
}
