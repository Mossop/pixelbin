use diesel_async::pooled_connection::deadpool::{BuildError, PoolError};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("{source}")]
    PoolBuildError {
        #[from]
        source: BuildError,
    },
    #[error("{source}")]
    PoolError {
        #[from]
        source: PoolError,
    },
    #[error("{source}")]
    QueryError {
        #[from]
        source: diesel::result::Error,
    },
    #[error("Unknown error")]
    Unknown,
}

pub type Result<T = ()> = std::result::Result<T, Error>;
