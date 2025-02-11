use actix_web::{dev::Payload, get, http::header, post, web, FromRequest, HttpRequest};
use futures::{future::LocalBoxFuture, join};
use pixelbin_shared::Ignorable;
use serde::{Deserialize, Serialize};
use tracing::{instrument, trace, warn, Instrument};

use crate::{
    server::{ApiErrorCode, ApiResult, AppState},
    shared::short_id,
    store::{
        db::Isolation,
        models::{self, AlbumWithCount, SavedSearchWithCount, SourceType, UserCatalogWithCount},
    },
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
                trace!("Missing session data in headers");
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
            let user = models::User::verify_token(&mut conn, &token).await?;

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
    match models::User::verify_credentials(&mut conn, &credentials.email, &credentials.password)
        .await
    {
        Ok((_, token)) => {
            conn.commit().await?;
            Ok(web::Json(LoginResponse { token: Some(token) }))
        }
        Err(Error::NotFound) => {
            conn.rollback().await.warn();
            Err(ApiErrorCode::NotLoggedIn)
        }
        Err(e) => {
            conn.rollback().await.warn();
            Err(e.into())
        }
    }
}

#[post("/logout")]
#[instrument(err, skip(app_state, token))]
async fn logout(
    app_state: web::Data<AppState>,
    token: AuthToken,
) -> ApiResult<web::Json<LoginResponse>> {
    if let Some(token) = token.0 {
        let mut conn = app_state.store.pooled();
        models::User::delete_token(&mut conn, &token).await?;
    }

    Ok(web::Json(LoginResponse { token: None }))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UserState {
    #[serde(flatten)]
    user: models::User,
    storage: Vec<models::Storage>,
    catalogs: Vec<UserCatalogWithCount>,
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

    let user = models::User::get(store.clone(), email).await?;

    let (storage, catalogs, albums, people, tags, searches) = join!(
        models::Storage::list_for_user(store.clone(), email).in_current_span(),
        models::Catalog::list_for_user_with_count(store.clone(), email).in_current_span(),
        models::Album::list_for_user_with_count(store.clone(), email).in_current_span(),
        models::Person::list_for_user(store.clone(), email).in_current_span(),
        models::Tag::list_for_user(store.clone(), email).in_current_span(),
        models::SavedSearch::list_for_user_with_count(store.clone(), email).in_current_span(),
    );

    Ok(web::Json(UserState {
        user,
        storage: storage?,
        catalogs: catalogs?,
        people: people?,
        tags: tags?,
        albums: albums?,
        searches: searches?,
    }))
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
async fn source(
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
