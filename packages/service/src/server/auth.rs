use actix_web::{dev::Payload, get, http::header, post, web, FromRequest, HttpRequest};
use futures::future::LocalBoxFuture;
use scoped_futures::ScopedFutureExt;
use serde::{Deserialize, Serialize};
use tracing::{instrument, warn};
use typeshare::typeshare;

use super::{util::long_id, ApiErrorCode, ApiResult, AppState};
use crate::store::models;
use crate::Error;

#[derive(Clone)]
pub(super) struct Session {
    pub(crate) id: String,
    pub(crate) email: String,
}

impl FromRequest for Session {
    type Error = ApiErrorCode;
    type Future = LocalBoxFuture<'static, ApiResult<Self>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let req = req.clone();

        Box::pin(async move {
            let maybe = MaybeSession::extract(&req).await?;
            if let Some(session) = maybe.0 {
                Ok(session)
            } else {
                Err(ApiErrorCode::NotLoggedIn)
            }
        })
    }
}

pub(super) struct MaybeSession(Option<Session>);

impl MaybeSession {
    pub(crate) fn session(&self) -> Option<&Session> {
        self.0.as_ref()
    }
}

impl FromRequest for MaybeSession {
    type Error = ApiErrorCode;
    type Future = LocalBoxFuture<'static, ApiResult<Self>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let req = req.clone();

        Box::pin(async move {
            let header = if let Some(header) = req.headers().get(header::AUTHORIZATION) {
                header.to_str().unwrap()
            } else {
                return Ok(MaybeSession(None));
            };

            let parts: Vec<&str> = header.split_ascii_whitespace().collect();
            if parts.len() != 2 {
                warn!(header, "Invalid authorization header");
                return Ok(MaybeSession(None));
            }

            if parts[0] != "Bearer" {
                warn!(scheme = parts[0], "Invalid authorization header");
                return Ok(MaybeSession(None));
            }

            let data = web::Data::<AppState>::extract(&req).await.unwrap();
            if let Some(session) = data.sessions.get(&parts[1].to_string()).await {
                Ok(MaybeSession(Some(session)))
            } else {
                warn!("Unknown authorization header");
                Ok(MaybeSession(None))
            }
        })
    }
}

#[typeshare]
#[derive(Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[typeshare]
#[derive(Serialize)]
struct LoginResponse {
    token: Option<String>,
}

#[post("/api/login")]
#[instrument(err, skip(app_state, credentials))]
async fn login(
    app_state: web::Data<AppState>,
    credentials: web::Json<LoginRequest>,
) -> ApiResult<web::Json<LoginResponse>> {
    match app_state
        .store
        .clone()
        .in_transaction(|mut trx| {
            async move {
                trx.verify_credentials(&credentials.email, &credentials.password)
                    .await
            }
            .scope_boxed()
        })
        .await
    {
        Ok(user) => {
            let token = long_id("T");
            app_state
                .sessions
                .insert(
                    token.clone(),
                    Session {
                        id: token.clone(),
                        email: user.email.clone(),
                    },
                )
                .await;

            Ok(web::Json(LoginResponse { token: Some(token) }))
        }
        Err(Error::NotFound) => Err(ApiErrorCode::NotLoggedIn),
        Err(e) => Err(e.into()),
    }
}

#[post("/api/logout")]
#[instrument(err, skip(app_state, session))]
async fn logout(
    app_state: web::Data<AppState>,
    session: MaybeSession,
) -> ApiResult<web::Json<LoginResponse>> {
    if let Some(session) = session.0 {
        app_state.sessions.delete(&session.id).await;
    }

    Ok(web::Json(LoginResponse { token: None }))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AlbumWithCount {
    #[serde(flatten)]
    album: models::Album,
    media: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SavedSearchWithCount {
    #[serde(flatten)]
    search: models::SavedSearch,
    media: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UserState {
    #[serde(flatten)]
    user: models::User,
    storage: Vec<models::Storage>,
    catalogs: Vec<models::Catalog>,
    people: Vec<models::Person>,
    tags: Vec<models::Tag>,
    albums: Vec<AlbumWithCount>,
    searches: Vec<SavedSearchWithCount>,
}

#[get("/api/state")]
#[instrument(err, skip(app_state, session))]
async fn state(
    app_state: web::Data<AppState>,
    session: Session,
) -> ApiResult<web::Json<UserState>> {
    let state = app_state
        .store
        .clone()
        .in_transaction(|mut db| {
            async move {
                let email = &session.email;
                let user = db.get_user(email).await?;

                let albums = db
                    .list_user_albums_with_count(email)
                    .await?
                    .into_iter()
                    .map(|(album, count)| AlbumWithCount {
                        album,
                        media: count,
                    })
                    .collect();

                let searches = db
                    .list_user_searches_with_count(email)
                    .await?
                    .into_iter()
                    .map(|(search, count)| SavedSearchWithCount {
                        search,
                        media: count,
                    })
                    .collect();

                Ok(UserState {
                    user,
                    storage: db.list_user_storage(email).await?,
                    catalogs: db.list_user_catalogs(email).await?,
                    people: db.list_user_people(email).await?,
                    tags: db.list_user_tags(email).await?,
                    albums,
                    searches,
                })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(state))
}
