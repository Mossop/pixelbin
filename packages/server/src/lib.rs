#![deny(unreachable_pub)]
use std::{fmt::Display, result, time::Duration};

use actix_web::{
    body::BoxBody, http::StatusCode, web, App, HttpResponse, HttpServer, ResponseError,
};
use auth::Session;
use cache::Cache;
use pixelbin_shared::{Error, Result};
use pixelbin_store::Store;
use serde::Serialize;

mod auth;
mod cache;
mod media;
mod middleware;
mod util;

const SESSION_LENGTH: u64 = 60 * 60 * 24 * 30;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase", tag = "error", content = "message")]
enum ApiErrorCode {
    // UnknownException,
    // BadMethod,
    NotLoggedIn,
    // LoginFailed,
    // InvalidData,
    NotFound,
    // TemporaryFailure,
    // InvalidHost,
    InternalError(String),
}

impl Display for ApiErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&serde_json::to_string_pretty(self).unwrap())
    }
}

impl ResponseError for ApiErrorCode {
    fn status_code(&self) -> StatusCode {
        match self {
            // ApiErrorCode::UnknownException => 500,
            // ApiErrorCode::BadMethod => 405,
            ApiErrorCode::NotLoggedIn => StatusCode::UNAUTHORIZED,
            // ApiErrorCode::LoginFailed => 401,
            // ApiErrorCode::InvalidData => 400,
            ApiErrorCode::NotFound => StatusCode::NOT_FOUND,
            // ApiErrorCode::TemporaryFailure => 503,
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

impl From<Error> for ApiErrorCode {
    fn from(value: Error) -> Self {
        match value {
            Error::NotFound => ApiErrorCode::NotFound,
            v => ApiErrorCode::InternalError(v.to_string()),
        }
    }
}

impl From<tokio::io::Error> for ApiErrorCode {
    fn from(value: tokio::io::Error) -> Self {
        ApiErrorCode::InternalError(value.to_string())
    }
}

struct AppState {
    store: Store,
    sessions: Cache<String, Session>,
}

pub async fn serve(store: Store) -> Result {
    let port = store.config().port.unwrap_or(80);

    let state = AppState {
        store,
        sessions: Cache::new(Duration::from_secs(SESSION_LENGTH)),
    };

    let app_data = web::Data::new(state);

    HttpServer::new(move || {
        App::new()
            .app_data(app_data.clone())
            .wrap(middleware::Logging)
            .service(auth::login)
            .service(auth::logout)
            .service(auth::state)
            .service(media::thumbnail_handler)
            .service(media::encoding_handler)
            .service(media::get_album_media)
            .service(media::get_search_media)
            .service(media::get_catalog_media)
            .service(media::get_album)
            .service(media::get_search)
            .service(media::get_catalog)
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await?;

    Ok(())
}
