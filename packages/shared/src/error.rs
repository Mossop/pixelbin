use std::io;

use actix_multipart::MultipartError;
use figment::Error as FigmentError;
use image::ImageError;
use mime::{FromStrError, Mime};
use thiserror::Error;
use tracing::error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("Database error: {source}")]
    SqlxError { source: sqlx::Error },
    #[error("Migration error: {message}")]
    MigrationError { message: String },
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

impl From<sqlx::Error> for Error {
    fn from(error: sqlx::Error) -> Self {
        if matches!(error, sqlx::Error::RowNotFound) {
            Error::NotFound
        } else {
            Error::SqlxError { source: error }
        }
    }
}

impl From<MultipartError> for Error {
    fn from(value: MultipartError) -> Self {
        Error::InvalidData {
            message: value.to_string(),
        }
    }
}

impl From<actix_web::Error> for Error {
    fn from(value: actix_web::Error) -> Self {
        Error::InvalidData {
            message: value.to_string(),
        }
    }
}
