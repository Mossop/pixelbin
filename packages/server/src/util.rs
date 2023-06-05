use std::fmt;

use actix_web::ResponseError;
use nano_id::base62;
use pixelbin_shared::Error;

pub(crate) fn long_id(prefix: &str) -> String {
    format!("{prefix}:{}", base62::<25>())
}

pub(crate) fn short_id(prefix: &str) -> String {
    format!("{prefix}:{}", base62::<10>())
}

#[derive(Debug)]
pub(crate) struct InternalError {
    inner: Error,
}

impl fmt::Display for InternalError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.inner.fmt(f)
    }
}

impl From<Error> for InternalError {
    fn from(value: Error) -> Self {
        Self { inner: value }
    }
}

impl ResponseError for InternalError {}

pub(crate) type HttpResult<T> = std::result::Result<T, InternalError>;
