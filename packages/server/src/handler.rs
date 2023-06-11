use actix_web::{
    body::BoxBody, get, http::StatusCode, post, web, HttpRequest, HttpResponse, Responder,
};
use mime_guess::from_path;
use pixelbin_shared::{Error, Result};
use pixelbin_store::{models, DbQueries};
use rust_embed::RustEmbed;
use scoped_futures::ScopedFutureExt;
use serde::{Deserialize, Serialize};
use serde_with::{formats::CommaSeparator, serde_as, StringWithSeparator};
use time::OffsetDateTime;
use tracing::instrument;

use crate::{
    middleware::cacheable,
    templates::{self, AlbumNav, CatalogNav, UserNav},
    AppState,
};
use crate::{util::HttpResult, Session};

#[derive(RustEmbed)]
#[folder = "../../target/web/static/"]
struct StaticAssets;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UserState {
    #[serde(flatten)]
    user: models::User,
    #[serde(flatten)]
    nav: UserNav,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiState {
    user: Option<UserState>,
}

fn build_searches(
    searches: &mut Vec<models::SavedSearch>,
    catalog: &str,
) -> Vec<models::SavedSearch> {
    let mut result = Vec::new();

    let mut i = 0;
    while i < searches.len() {
        if searches[i].catalog == catalog {
            result.push(searches.swap_remove(i));
        } else {
            i += 1;
        }
    }

    result
}

fn build_album_children(albums: &Vec<models::Album>, alb: &str) -> Vec<AlbumNav> {
    albums
        .iter()
        .filter_map(|a| {
            if a.parent.as_deref() == Some(alb) {
                Some(AlbumNav {
                    album: a.clone(),
                    children: build_album_children(albums, &a.id),
                })
            } else {
                None
            }
        })
        .collect()
}

fn build_catalog_albums(albums: &Vec<models::Album>, catalog: &str) -> Vec<AlbumNav> {
    albums
        .iter()
        .filter_map(|a| {
            if a.catalog == catalog && a.parent == None {
                Some(AlbumNav {
                    album: a.clone(),
                    children: build_album_children(albums, &a.id),
                })
            } else {
                None
            }
        })
        .collect()
}

#[instrument(skip_all, err)]
async fn build_state<Q: DbQueries + Send>(db: &mut Q, session: &Session) -> Result<ApiState> {
    if let Some(ref email) = session.email {
        let user = db.user(email).await?;
        let catalogs = db.list_user_catalogs(email).await?;
        let catalog_ids: Vec<&str> = catalogs.iter().map(|c| c.id.as_str()).collect();
        let albums = db.list_user_albums(&email).await?;
        let mut searches = db.list_user_searches(&email).await?;

        let catalog_nav = catalogs
            .into_iter()
            .map(|catalog| CatalogNav {
                albums: build_catalog_albums(&albums, &catalog.id),
                searches: build_searches(&mut searches, &catalog.id),
                catalog,
            })
            .collect::<Vec<CatalogNav>>();

        Ok(ApiState {
            user: Some(UserState {
                user,
                nav: UserNav {
                    catalogs: catalog_nav,
                },
            }),
        })
    } else {
        Ok(ApiState { user: None })
    }
}

async fn not_found(app_state: &AppState<'_>, state: ApiState) -> Result<HttpResponse> {
    Ok(HttpResponse::NotFound().content_type("text/html").body(
        app_state
            .templates
            .not_found(templates::NotFound { state })?,
    ))
}

#[get("/")]
async fn index(app_state: web::Data<AppState<'_>>, session: Session) -> HttpResult<impl Responder> {
    let api_state = app_state
        .store
        .clone()
        .in_transaction(|mut trx| {
            async move { build_state(&mut trx, &session).await }.scope_boxed()
        })
        .await?;

    Ok(HttpResponse::Ok().content_type("text/html").body(
        app_state
            .templates
            .index(templates::Index { state: api_state })?,
    ))
}

#[get("/album/{album_id}")]
async fn album(
    app_state: web::Data<AppState<'_>>,
    session: Session,
    album_id: web::Path<String>,
) -> HttpResult<impl Responder> {
    let email = if let Some(ref email) = session.email {
        email.to_owned()
    } else {
        return Ok(not_found(&app_state, ApiState { user: None }).await?);
    };

    match app_state
        .store
        .in_transaction(|mut trx| {
            async move {
                let state = build_state(&mut trx, &session).await?;

                let album = trx.user_album(&email, &album_id).await?;

                Ok(templates::Album { state, album })
            }
            .scope_boxed()
        })
        .await
    {
        Ok(data) => Ok(HttpResponse::Ok()
            .content_type("text/html")
            .body(app_state.templates.album(data)?)),
        Err(Error::NotFound) => Ok(not_found(&app_state, ApiState { user: None }).await?),
        Err(e) => Err(e.into()),
    }
}

#[get("/static/{_:.*}")]
async fn static_files(path: web::Path<String>, request: HttpRequest) -> HttpResult<impl Responder> {
    let local_path = path.to_owned();

    match StaticAssets::get(&local_path) {
        Some(content) => {
            let last_modified = content
                .metadata
                .last_modified()
                .and_then(|lm| OffsetDateTime::from_unix_timestamp(lm as i64).ok());

            Ok(cacheable(&request, last_modified, || {
                Box::pin(async move {
                    Ok(HttpResponse::Ok()
                        .content_type(from_path(local_path).first_or_octet_stream().as_ref())
                        .body(content.data.into_owned()))
                })
            })
            .await?)
        }
        None => Ok(HttpResponse::NotFound().body("404 Not Found")),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
enum ApiErrorCode {
    UnknownException,
    BadMethod,
    NotLoggedIn,
    LoginFailed,
    InvalidData,
    NotFound,
    TemporaryFailure,
    InvalidHost,
}

impl ApiErrorCode {
    fn into<T>(self) -> ApiResult<T> {
        ApiResult::Err(ApiError { code: self })
    }
}

#[derive(Serialize)]
struct ApiError {
    code: ApiErrorCode,
}

impl Into<HttpResponse> for ApiError {
    fn into(self) -> HttpResponse {
        let code = match self.code {
            ApiErrorCode::UnknownException => 500,
            ApiErrorCode::BadMethod => 405,
            ApiErrorCode::NotLoggedIn => 401,
            ApiErrorCode::LoginFailed => 401,
            ApiErrorCode::InvalidData => 400,
            ApiErrorCode::NotFound => 404,
            ApiErrorCode::TemporaryFailure => 503,
            ApiErrorCode::InvalidHost => 403,
        };

        HttpResponse::build(StatusCode::from_u16(code).unwrap())
            .content_type("application/json")
            .body(serde_json::to_string_pretty(&self).unwrap())
    }
}

enum ApiResult<T> {
    Ok(T),
    Err(ApiError),
}

impl<T> From<T> for ApiResult<T> {
    fn from(result: T) -> Self {
        Self::Ok(result)
    }
}

impl<T: Serialize> Responder for ApiResult<T> {
    type Body = BoxBody;

    fn respond_to(self, _req: &actix_web::HttpRequest) -> HttpResponse<Self::Body> {
        match self {
            ApiResult::Ok(inner) => HttpResponse::Ok()
                .content_type("application/json")
                .body(serde_json::to_string_pretty(&inner).unwrap()),
            ApiResult::Err(err) => err.into(),
        }
    }
}

#[derive(Deserialize)]
struct Credentials {
    email: String,
    password: String,
}

#[post("/api/login")]
async fn api_login(
    app_state: web::Data<AppState<'_>>,
    session: Session,
    credentials: web::Json<Credentials>,
) -> HttpResult<ApiResult<ApiState>> {
    Ok(app_state
        .store
        .clone()
        .in_transaction(|mut trx| {
            async move {
                match trx
                    .verify_credentials(&credentials.email, &credentials.password)
                    .await
                {
                    Ok(user) => {
                        let session = app_state
                            .sessions
                            .update(&session.id, |sess| {
                                sess.email = Some(user.email.clone());
                            })
                            .await
                            .unwrap();

                        Ok(build_state(&mut trx, &session).await?.into())
                    }
                    Err(Error::NotFound) => Ok(ApiErrorCode::NotLoggedIn.into()),
                    Err(e) => Err(e.into()),
                }
            }
            .scope_boxed()
        })
        .await?)
}

#[post("/api/logout")]
async fn api_logout(
    app_state: web::Data<AppState<'_>>,
    session: Session,
) -> HttpResult<ApiResult<ApiState>> {
    let session = app_state
        .sessions
        .update(&session.id, |sess| {
            sess.email = None;
        })
        .await
        .unwrap();

    Ok(app_state
        .store
        .in_transaction(|mut trx| {
            async move { Ok(build_state(&mut trx, &session).await?.into()) }.scope_boxed()
        })
        .await?)
}

#[serde_as]
#[derive(Deserialize)]
struct MediaList {
    #[serde_as(as = "StringWithSeparator::<CommaSeparator, String>")]
    id: Vec<String>,
}

#[get("/api/media/get")]
async fn api_media_get(media_list: web::Query<MediaList>) -> HttpResult<HttpResponse> {
    todo!();
}
