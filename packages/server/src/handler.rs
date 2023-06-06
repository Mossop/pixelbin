use actix_web::{body::BoxBody, get, http::StatusCode, post, web, HttpResponse, Responder};
use mime_guess::from_path;
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use serde_with::{formats::CommaSeparator, serde_as, StringWithSeparator};

use crate::util::HttpResult;
use crate::AppState;

#[derive(RustEmbed)]
#[folder = "../../target/web/static/"]
struct StaticAssets;

#[get("/")]
async fn index(state: web::Data<AppState<'_>>) -> HttpResult<impl Responder> {
    Ok(HttpResponse::Ok()
        .content_type("text/html")
        .body(state.templates.index()?))
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

    fn respond_to(self, req: &actix_web::HttpRequest) -> HttpResponse<Self::Body> {
        match self {
            ApiResult::Ok(inner) => HttpResponse::Ok()
                .content_type("application/json")
                .body(serde_json::to_string_pretty(&inner).unwrap()),
            ApiResult::Err(err) => err.into(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CatalogState {
    id: String,
    storage: String,
    name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AlbumState {
    id: String,
    catalog: String,
    parent: Option<String>,
    name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UserState {
    catalogs: Vec<CatalogState>,
    albums: Vec<AlbumState>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiState {
    user: Option<UserState>,
    api_host: Option<String>,
}

#[derive(Deserialize)]
struct Credentials {
    email: String,
    password: String,
}

#[post("/api/login")]
async fn api_login(credentials: web::Json<Credentials>) -> HttpResult<ApiResult<ApiState>> {
    Ok(ApiErrorCode::NotLoggedIn.into())
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
