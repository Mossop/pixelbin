use actix_web::{dev::Payload, get, http::header, post, web, FromRequest, HttpRequest};
use futures::future::LocalBoxFuture;
use scoped_futures::ScopedFutureExt;
use serde::{Deserialize, Serialize};
use tracing::{instrument, warn};
use typeshare::typeshare;

use super::{ApiErrorCode, ApiResult, AppState};
use crate::store::models;
use crate::Error;

#[derive(Clone)]
pub(super) struct Session {
    pub(crate) user: models::User,
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

struct AuthToken(Option<String>);

impl FromRequest for AuthToken {
    type Error = ApiErrorCode;
    type Future = LocalBoxFuture<'static, ApiResult<Self>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let req = req.clone();

        Box::pin(async move {
            let header = if let Some(header) = req.headers().get(header::AUTHORIZATION) {
                header.to_str().unwrap()
            } else {
                return Ok(AuthToken(None));
            };

            let parts: Vec<&str> = header.split_ascii_whitespace().collect();
            if parts.len() != 2 {
                warn!(header, "Invalid authorization header");
                return Ok(AuthToken(None));
            }

            if parts[0] != "Bearer" {
                warn!(scheme = parts[0], "Invalid authorization header");
                return Ok(AuthToken(None));
            }

            Ok(AuthToken(Some(parts[1].to_owned())))
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
            let token = if let Some(token) = AuthToken::extract(&req).await?.0 {
                token
            } else {
                return Ok(MaybeSession(None));
            };

            let otoken = token.clone();
            let data = web::Data::<AppState>::extract(&req).await.unwrap();
            let user = data
                .store
                .with_connection(|mut conn| {
                    async move { conn.verify_token(&otoken).await }.scope_boxed()
                })
                .await?;

            Ok(MaybeSession(Some(Session { user })))
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
        .in_transaction(|mut trx| {
            async move {
                trx.verify_credentials(&credentials.email, &credentials.password)
                    .await
            }
            .scope_boxed()
        })
        .await
    {
        Ok((_, token)) => Ok(web::Json(LoginResponse { token: Some(token) })),
        Err(Error::NotFound) => Err(ApiErrorCode::NotLoggedIn),
        Err(e) => Err(e.into()),
    }
}

#[post("/api/logout")]
#[instrument(err, skip(app_state, token))]
async fn logout(
    app_state: web::Data<AppState>,
    token: AuthToken,
) -> ApiResult<web::Json<LoginResponse>> {
    if let Some(token) = token.0 {
        app_state
            .store
            .in_transaction(|mut trx| async move { trx.delete_token(&token).await }.scope_boxed())
            .await?;
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
                let email = &session.user.email;
                let user = models::User::get(&mut db, email).await?;

                let albums = models::Album::list_for_user_with_count(&mut db, email)
                    .await?
                    .into_iter()
                    .map(|(album, count)| AlbumWithCount {
                        album,
                        media: count,
                    })
                    .collect();

                let searches = models::SavedSearch::list_for_user_with_count(&mut db, email)
                    .await?
                    .into_iter()
                    .map(|(search, count)| SavedSearchWithCount {
                        search,
                        media: count,
                    })
                    .collect();

                Ok(UserState {
                    user,
                    storage: models::Storage::list_for_user(&mut db, email).await?,
                    catalogs: models::Catalog::list_for_user(&mut db, email).await?,
                    people: models::Person::list_for_user(&mut db, email).await?,
                    tags: models::Tag::list_for_user(&mut db, email).await?,
                    albums,
                    searches,
                })
            }
            .scope_boxed()
        })
        .await?;

    Ok(web::Json(state))
}
