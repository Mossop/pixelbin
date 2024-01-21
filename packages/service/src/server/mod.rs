use std::{collections::HashMap, fmt::Display, result};

use actix_web::{
    body::BoxBody,
    get,
    http::{StatusCode, Uri},
    web, App, HttpResponse, HttpServer, ResponseError,
};
use serde::Serialize;
use tracing::instrument;

use crate::{shared::config::ThumbnailConfig, store::Store};
use crate::{Error, Result};

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
    // InvalidData,
    NotFound,
    NotImplemented,
    // InvalidHost,
    InternalError(Error),
}

impl Serialize for ApiErrorCode {
    fn serialize<S>(&self, serializer: S) -> result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let (error, message) = match self {
            ApiErrorCode::NotLoggedIn => ("NotLoggedIn", None),
            ApiErrorCode::NotFound => ("NotFound", None),
            ApiErrorCode::NotImplemented => ("NotImplemented", None),
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
            ApiErrorCode::NotFound => f.write_str("APIError: NotFound"),
            ApiErrorCode::NotImplemented => f.write_str("APIError: NotImplemented"),
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
            // ApiErrorCode::InvalidData => 400,
            ApiErrorCode::NotFound => StatusCode::NOT_FOUND,
            ApiErrorCode::NotImplemented => StatusCode::NOT_IMPLEMENTED,
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
            v => ApiErrorCode::InternalError(v),
        }
    }
}

struct AppState {
    store: Store,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiConfig {
    api_url: String,
    thumbnails: ThumbnailConfig,
}

#[get("/api/config")]
#[instrument(err, skip(app_state))]
async fn config(app_state: web::Data<AppState>, uri: Uri) -> ApiResult<web::Json<ApiConfig>> {
    let config = app_state.store.config();

    let api_url = config.api_url.clone().unwrap_or_else(|| {
        let path = uri.path();
        let end = path.len() - 10;

        format!(
            "http://localhost:{}{}",
            config.port.unwrap_or(80),
            &path[0..end]
        )
    });

    Ok(web::Json(ApiConfig {
        api_url,
        thumbnails: config.thumbnails.clone(),
    }))
}

pub async fn serve(store: Store) -> Result {
    let port = store.config().port.unwrap_or(80);

    let state = AppState { store };

    let app_data = web::Data::new(state);

    HttpServer::new(move || {
        App::new()
            .app_data(app_data.clone())
            .wrap(middleware::Logging)
            .service(config)
            .service(auth::login)
            .service(auth::logout)
            .service(auth::state)
            .service(media::thumbnail_handler)
            .service(media::encoding_handler)
            .service(media::download_handler)
            .service(relations::get_album_media)
            .service(relations::get_search_media)
            .service(relations::get_catalog_media)
            .service(relations::get_album)
            .service(relations::get_search)
            .service(relations::get_catalog)
            .service(media::get_media)
            .service(media::create_media)
            .service(media::edit_media)
            .service(media::delete_media)
            .service(relations::create_album)
            .service(relations::edit_album)
            .service(relations::delete_album)
            .service(relations::update_relations)
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await?;

    Ok(())
}
