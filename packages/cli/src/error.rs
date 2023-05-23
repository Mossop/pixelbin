use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("{source}")]
    StoreError {
        #[from]
        source: pixelbin_store::Error,
    },
    #[error("Unknown error")]
    Unknown,
}

pub type Result<T = ()> = std::result::Result<T, Error>;
