use std::io;

#[cfg(feature = "webserver")]
use actix_multipart::MultipartError;
use diesel::ConnectionError;
use diesel_async::pooled_connection::deadpool::{BuildError, PoolError};
use figment::Error as FigmentError;
use image::ImageError;
use mime::{FromStrError, Mime};
use thiserror::Error;
use tracing::{error, warn};

#[derive(Debug, Error)]
pub enum Error {
    #[error("Database error: {source}")]
    DbConnectionError {
        #[from]
        source: ConnectionError,
    },
    #[error("Database error: {source}")]
    DbPoolBuildError {
        #[from]
        source: BuildError,
    },
    #[error("Database error: {source}")]
    DbPoolError {
        #[from]
        source: PoolError,
    },
    #[error("Database error: {source}")]
    DbQueryError { source: diesel::result::Error },
    #[error("Database error: {message}")]
    DbMigrationError { message: String },
    #[error("JSON error: {source}")]
    JsonError {
        #[from]
        source: serde_json::Error,
    },
    #[error("Item requested does not exist")]
    NotFound,
    #[error("Config file error: {message}")]
    ConfigError { message: String },
    #[error("Config file error: {source}")]
    ConfigParseError {
        #[from]
        source: FigmentError,
    },
    #[error("IO error: {source}")]
    IoError {
        #[from]
        source: io::Error,
    },
    #[error("S3 error: {message}")]
    S3Error { message: String },
    #[error("Unexpected path")]
    UnexpectedPath { path: String },
    #[error("Invalid client data: {message}")]
    InvalidData { message: String },
    #[error("Unsupported media type: {mime}")]
    UnsupportedMedia { mime: Mime },
    #[error("Image error: {source}")]
    ImageError {
        #[from]
        source: ImageError,
    },
    #[error("Invalid mime type: {source}")]
    MimeError {
        #[from]
        source: FromStrError,
    },
    #[error("Unknown error: {message}")]
    Unknown { message: String },
}

pub(crate) trait Ignorable {
    fn ignore(self);
    fn warn(self);
}

impl<R, E> Ignorable for std::result::Result<R, E>
where
    E: std::fmt::Debug,
{
    fn ignore(self) {}

    fn warn(self) {
        if let Err(e) = self {
            warn!(error=?e);
        }
    }
}

impl From<diesel::result::Error> for Error {
    fn from(error: diesel::result::Error) -> Self {
        if error == diesel::result::Error::NotFound {
            Error::NotFound
        } else {
            Error::DbQueryError { source: error }
        }
    }
}

pub type Result<T = ()> = std::result::Result<T, Error>;

#[cfg(feature = "webserver")]
impl From<MultipartError> for Error {
    fn from(value: MultipartError) -> Self {
        Error::InvalidData {
            message: value.to_string(),
        }
    }
}

#[cfg(feature = "webserver")]
impl From<actix_web::Error> for Error {
    fn from(value: actix_web::Error) -> Self {
        Error::InvalidData {
            message: value.to_string(),
        }
    }
}
