use std::{collections::HashMap, env, fmt::Display, result, time::Duration};

use actix_web::{
    body::BoxBody,
    get,
    guard::GuardContext,
    http::{
        header::{
            HeaderValue, ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_METHODS,
            ACCESS_CONTROL_ALLOW_ORIGIN, ACCESS_CONTROL_MAX_AGE, ACCESS_CONTROL_REQUEST_METHOD,
            ORIGIN,
        },
        Method, StatusCode, Uri,
    },
    middleware::from_fn,
    web, App, HttpRequest, HttpResponse, HttpServer, ResponseError,
};
use pixelbin_shared::ThumbnailConfig;
use serde::Serialize;
use sqlx::postgres::PgPoolOptions;
use tracing::instrument;

use crate::{store::Store, Error, Result};

mod auth;
mod media;
mod middleware;
mod relations;
mod util;

#[derive(Debug)]
enum ApiErrorCode {
    // UnknownException,
    // BadMethod,
    NotLoggedIn,
    // LoginFailed,
    InvalidData(String),
    NotFound,
    // InvalidHost,
    InternalError(Error),
}

#[derive(Serialize)]
struct ApiResponse {
    message: String,
}

impl Default for ApiResponse {
    fn default() -> Self {
        ApiResponse {
            message: "Ok".to_string(),
        }
    }
}

impl Serialize for ApiErrorCode {
    fn serialize<S>(&self, serializer: S) -> result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let (error, message) = match self {
            ApiErrorCode::NotLoggedIn => ("NotLoggedIn", None),
            ApiErrorCode::InvalidData(message) => ("InvalidData", Some(message.clone())),
            ApiErrorCode::NotFound => ("NotFound", None),
            ApiErrorCode::InternalError(error) => ("InternalError", Some(error.to_string())),
        };

        let mut map = HashMap::new();
        map.insert("error".to_string(), error.to_owned());

        if let Some(message) = message {
            map.insert("message".to_string(), message);
        }

        map.serialize(serializer)
    }
}

impl Display for ApiErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ApiErrorCode::NotLoggedIn => f.write_str("APIError: NotLoggedIn"),
            ApiErrorCode::InvalidData(message) => {
                f.write_fmt(format_args!("APIError: InternalError: {}", message))
            }
            ApiErrorCode::NotFound => f.write_str("APIError: NotFound"),
            ApiErrorCode::InternalError(error) => {
                f.write_fmt(format_args!("APIError: InternalError: {}", error))
            }
        }
    }
}

impl ResponseError for ApiErrorCode {
    fn status_code(&self) -> StatusCode {
        match self {
            // ApiErrorCode::UnknownException => 500,
            // ApiErrorCode::BadMethod => 405,
            ApiErrorCode::NotLoggedIn => StatusCode::UNAUTHORIZED,
            // ApiErrorCode::LoginFailed => 401,
            ApiErrorCode::InvalidData(_) => StatusCode::NOT_ACCEPTABLE,
            ApiErrorCode::NotFound => StatusCode::NOT_FOUND,
            // ApiErrorCode::InvalidHost => 403,
            ApiErrorCode::InternalError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse<BoxBody> {
        HttpResponse::build(self.status_code())
            .content_type("application/json")
            .body(serde_json::to_string_pretty(&self).unwrap())
    }
}

type ApiResult<T> = result::Result<T, ApiErrorCode>;

impl<T> From<T> for ApiErrorCode
where
    T: Into<Error>,
{
    fn from(value: T) -> Self {
        let error: Error = value.into();
        match error {
            Error::NotFound => ApiErrorCode::NotFound,
            Error::InvalidData { message } => ApiErrorCode::InvalidData(message),
            v => ApiErrorCode::InternalError(v),
        }
    }
}

struct AppState {
    store: Store,
    request_tracker: middleware::RequestTracker,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    service_changeset: Option<String>,
    api_url: String,
    base_url: String,
    thumbnails: ThumbnailConfig,
}

#[get("/config")]
#[instrument(err, skip(app_state))]
async fn config(app_state: web::Data<AppState>, uri: Uri) -> ApiResult<web::Json<ApiConfig>> {
    let config = app_state.store.config();

    Ok(web::Json(ApiConfig {
        service_changeset: env::var("SOURCE_CHANGESET").ok(),
        api_url: config.api_url.to_string(),
        base_url: config.base_url.to_string(),
        thumbnails: config.thumbnails.clone(),
    }))
}

fn preflight_guard(ctx: &GuardContext<'_>) -> bool {
    if ctx.head().method != Method::OPTIONS {
        return false;
    }

    if ctx.head().headers().get(ORIGIN).is_none() {
        return false;
    }

    if ctx
        .head()
        .headers()
        .get(ACCESS_CONTROL_REQUEST_METHOD)
        .is_none()
    {
        return false;
    }

    true
}

async fn preflight(req: HttpRequest, app_state: web::Data<AppState>) -> HttpResponse {
    let headers = req.headers();

    let base_url = &app_state.store.config().base_url;
    let web_origin = format!(
        "{}://{}",
        base_url.scheme().unwrap(),
        base_url.authority().unwrap()
    );

    if *headers.get(ORIGIN).unwrap() == *web_origin {
        let mut response = HttpResponse::new(StatusCode::NO_CONTENT);
        response.headers_mut().insert(
            ACCESS_CONTROL_ALLOW_ORIGIN,
            HeaderValue::from_str(&web_origin).unwrap(),
        );
        response.headers_mut().insert(
            ACCESS_CONTROL_ALLOW_METHODS,
            HeaderValue::from_str("POST,GET,OPTIONS").unwrap(),
        );
        response.headers_mut().insert(
            ACCESS_CONTROL_ALLOW_HEADERS,
            HeaderValue::from_str("Content-Type").unwrap(),
        );
        response.headers_mut().insert(
            ACCESS_CONTROL_MAX_AGE,
            HeaderValue::from_str("86400").unwrap(),
        );

        response
    } else {
        HttpResponse::new(StatusCode::NOT_ACCEPTABLE)
    }
}

pub async fn serve(store: &Store) -> Result {
    // Use a dedicated pool for the web server so nothing else can starve it of
    // connections.
    let pool = PgPoolOptions::new()
        .min_connections(10)
        .max_connections(30)
        .acquire_timeout(Duration::from_secs(10))
        .connect(&store.config().database_url)
        .await?;

    let state = AppState {
        store: store.with_pool(pool),
        request_tracker: middleware::RequestTracker::new(store.clone()).await,
    };

    let app_data = web::Data::new(state);

    HttpServer::new(move || {
        App::new()
            .app_data(app_data.clone())
            .wrap(from_fn(middleware::middleware))
            .service(
                web::resource("/{any:.*}")
                    .guard(preflight_guard)
                    .to(preflight),
            )
            .service(
                web::scope("/api")
                    .service(config)
                    .service(auth::login)
                    .service(auth::logout)
                    .service(auth::state)
                    .service(relations::get_album_media)
                    .service(relations::get_search_media)
                    .service(relations::get_catalog_media)
                    .service(relations::get_album)
                    .service(relations::get_search)
                    .service(relations::get_catalog)
                    .service(media::get_media)
                    .service(media::create_media)
                    .service(media::upload_media)
                    .service(media::edit_media)
                    .service(media::delete_media)
                    .service(media::search_media)
                    .service(relations::create_album)
                    .service(relations::edit_album)
                    .service(relations::delete_album)
                    .service(relations::album_media_change)
                    .service(relations::subscribe)
                    .service(relations::verify_subscription)
                    .service(relations::unsubscribe),
            )
            .service(
                web::scope("/media")
                    .service(media::thumbnail_handler)
                    .service(media::encoding_handler)
                    .service(media::download_handler)
                    .service(media::social_handler),
            )
    })
    .bind(("0.0.0.0", store.config().api_port))?
    .run()
    .await?;

    Ok(())
}
