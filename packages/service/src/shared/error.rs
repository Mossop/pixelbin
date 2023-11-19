use std::io;

use diesel::ConnectionError;
use diesel_async::pooled_connection::deadpool::{BuildError, PoolError};
use handlebars::RenderError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("Database Error: {source}")]
    DbConnectionError {
        #[from]
        source: ConnectionError,
    },
    #[error("Database Error: {source}")]
    DbPoolBuildError {
        #[from]
        source: BuildError,
    },
    #[error("Database Error: {source}")]
    DbPoolError {
        #[from]
        source: PoolError,
    },
    #[error("Database Error: {source}")]
    DbQueryError { source: diesel::result::Error },
    #[error("Database Error: {message}")]
    DbMigrationError { message: String },
    #[error("JSON Error: {source}")]
    JsonError {
        #[from]
        source: serde_json::Error,
    },
    #[error("Item requested does not exist")]
    NotFound,
    #[error("Config File Error: {message}")]
    ConfigError { message: String },
    #[error("IO Error: {source}")]
    IoError {
        #[from]
        source: io::Error,
    },
    #[error("Template Error: {source}")]
    RenderError {
        #[from]
        source: RenderError,
    },
    #[error("S3 Error: {message}")]
    S3Error { message: String },
    #[error("Unexpected path")]
    UnexpectedPath { path: String },
    #[error("Unknown error: {message}")]
    Unknown { message: String },
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
