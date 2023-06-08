use actix_web::{body::BoxBody, get, http::StatusCode, post, web, HttpResponse, Responder};
use mime_guess::from_path;
use pixelbin_shared::Result;
use pixelbin_store::{models, DbQueries};
use rust_embed::RustEmbed;
use scoped_futures::ScopedFutureExt;
use serde::{Deserialize, Serialize};
use serde_with::{formats::CommaSeparator, serde_as, StringWithSeparator};
use tracing::instrument;

use crate::{templates, AppState};
use crate::{util::HttpResult, Session};

#[derive(RustEmbed)]
#[folder = "../../target/web/static/"]
struct StaticAssets;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UserState {
    #[serde(flatten)]
    user: models::User,
    storage: Vec<models::Storage>,
    catalogs: Vec<models::Catalog>,
    people: Vec<models::Person>,
    tags: Vec<models::Tag>,
    albums: Vec<models::Album>,
    searches: Vec<models::SavedSearch>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiState {
    user: Option<UserState>,
}

#[instrument(skip_all, err)]
async fn build_state<Q: DbQueries + Send>(db: &mut Q, session: &Session) -> Result<ApiState> {
    if let Some(ref email) = session.email {
        let user = db.user(email).await?;
        let catalogs = db.list_user_catalogs(email).await?;
        let catalog_ids: Vec<&str> = catalogs.iter().map(|c| c.id.as_str()).collect();

        Ok(ApiState {
            user: Some(UserState {
                user,
                storage: db.list_user_storage(email).await?,
                people: db.list_catalog_people(&catalog_ids).await?,
                tags: db.list_catalog_tags(&catalog_ids).await?,
                albums: db.list_catalog_albums(&catalog_ids).await?,
                searches: db.list_catalog_searches(&catalog_ids).await?,
                catalogs,
            }),
        })
    } else {
        Ok(ApiState { user: None })
    }
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

#[get("/static/{_:.*}")]
async fn static_files(path: web::Path<String>) -> impl Responder {
    let local_path = path.as_str();

    match StaticAssets::get(local_path) {
        Some(content) => HttpResponse::Ok()
            .content_type(from_path(local_path).first_or_octet_stream().as_ref())
            .body(content.data.into_owned()),
        None => HttpResponse::NotFound().body("404 Not Found"),
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
                    .await?
                {
                    Some(user) => {
                        let session = app_state
                            .sessions
                            .update(&session.id, |sess| {
                                sess.email = Some(user.email.clone());
                            })
                            .await
                            .unwrap();

                        Ok(build_state(&mut trx, &session).await?.into())
                    }
                    None => Ok(ApiErrorCode::NotLoggedIn.into()),
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
