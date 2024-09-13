use actix_web::{dev::Payload, get, http::header, post, web, FromRequest, HttpRequest};
use futures::{future::LocalBoxFuture, join, TryFutureExt};
use serde::{Deserialize, Serialize};
use tracing::{instrument, warn, Instrument};

use crate::{
    server::{ApiErrorCode, ApiResult, AppState},
    store::{models, Isolation},
    Error,
};

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

            let data = web::Data::<AppState>::extract(&req).await.unwrap();
            let mut conn = data.store.connect().await?;
            let user = conn.verify_token(&token).await?;

            Ok(MaybeSession(user.map(|user| Session { user })))
        })
    }
}

#[derive(Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Serialize)]
struct LoginResponse {
    token: Option<String>,
}

#[post("/login")]
#[instrument(err, skip(app_state, credentials))]
async fn login(
    app_state: web::Data<AppState>,
    credentials: web::Json<LoginRequest>,
) -> ApiResult<web::Json<LoginResponse>> {
    let mut conn = app_state.store.isolated(Isolation::Committed).await?;
    match conn
        .verify_credentials(&credentials.email, &credentials.password)
        .await
    {
        Ok((_, token)) => {
            conn.commit().await?;
            Ok(web::Json(LoginResponse { token: Some(token) }))
        }
        Err(Error::NotFound) => Err(ApiErrorCode::NotLoggedIn),
        Err(e) => Err(e.into()),
    }
}

#[post("/logout")]
#[instrument(err, skip(app_state, token))]
async fn logout(
    app_state: web::Data<AppState>,
    token: AuthToken,
) -> ApiResult<web::Json<LoginResponse>> {
    if let Some(token) = token.0 {
        let mut conn = app_state.store.connect().await?;
        conn.delete_token(&token).await?;
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
struct CatalogState {
    #[serde(flatten)]
    catalog: models::Catalog,
    writable: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UserState {
    #[serde(flatten)]
    user: models::User,
    storage: Vec<models::Storage>,
    catalogs: Vec<CatalogState>,
    people: Vec<models::Person>,
    tags: Vec<models::Tag>,
    albums: Vec<AlbumWithCount>,
    searches: Vec<SavedSearchWithCount>,
}

#[get("/state")]
#[instrument(err, skip(app_state, session))]
async fn state(
    app_state: web::Data<AppState>,
    session: Session,
) -> ApiResult<web::Json<UserState>> {
    let store = &app_state.store;
    let email = &session.user.email;

    let mut conn = store.connect().await?;
    let user = models::User::get(&mut conn, email).await?;

    let (storage, catalogs, albums, people, tags, searches) = join!(
        store
            .connect()
            .and_then(
                |mut conn| async move { models::Storage::list_for_user(&mut conn, email).await }
            )
            .in_current_span(),
        store
            .connect()
            .and_then(
                |mut conn| async move { models::Catalog::list_for_user(&mut conn, email).await }
            )
            .in_current_span(),
        store
            .connect()
            .and_then(|mut conn| async move {
                models::Album::list_for_user_with_count(&mut conn, email).await
            })
            .in_current_span(),
        store
            .connect()
            .and_then(
                |mut conn| async move { models::Person::list_for_user(&mut conn, email).await }
            )
            .in_current_span(),
        store
            .connect()
            .and_then(|mut conn| async move { models::Tag::list_for_user(&mut conn, email).await })
            .in_current_span(),
        store
            .connect()
            .and_then(|mut conn| async move {
                models::SavedSearch::list_for_user_with_count(&mut conn, email).await
            })
            .in_current_span(),
    );

    let albums = albums?
        .into_iter()
        .map(|(album, count)| AlbumWithCount {
            album,
            media: count,
        })
        .collect();

    let searches = searches?
        .into_iter()
        .map(|(search, count)| SavedSearchWithCount {
            search,
            media: count,
        })
        .collect();

    Ok(web::Json(UserState {
        user,
        storage: storage?,
        catalogs: catalogs?
            .into_iter()
            .map(|(c, w)| CatalogState {
                catalog: c,
                writable: w,
            })
            .collect(),
        people: people?,
        tags: tags?,
        albums,
        searches,
    }))
}
