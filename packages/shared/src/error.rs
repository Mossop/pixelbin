use std::io;

use diesel_async::pooled_connection::deadpool::{BuildError, PoolError};
use handlebars::RenderError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
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
    DbQueryError {
        #[from]
        source: diesel::result::Error,
    },
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
    #[error("Unknown error")]
    Unknown,
}

pub type Result<T = ()> = std::result::Result<T, Error>;
