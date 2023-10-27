use std::{cmp::max, fmt, io, path::PathBuf};

use actix_web::{
    body::BoxBody,
    http::header::{self, TryIntoHeaderValue},
    HttpResponse, ResponseError,
};
use nano_id::base62;
use pixelbin_shared::Error;
use pixelbin_store::{models, MediaFilePath};

pub(crate) fn long_id(prefix: &str) -> String {
    format!("{prefix}:{}", base62::<25>())
}

// pub(crate) fn short_id(prefix: &str) -> String {
//     format!("{prefix}:{}", base62::<10>())
// }

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

impl From<io::Error> for InternalError {
    fn from(value: io::Error) -> Self {
        Self {
            inner: value.into(),
        }
    }
}

impl ResponseError for InternalError {
    fn error_response(&self) -> HttpResponse<BoxBody> {
        let mut res = HttpResponse::new(self.status_code());
        let message = format!("{}", self);

        tracing::error!(message = message);

        let mime = mime::TEXT_PLAIN_UTF_8.try_into_value().unwrap();
        res.headers_mut().insert(header::CONTENT_TYPE, mime);

        res.set_body(BoxBody::new(message))
    }
}

fn alt_size(alt: &(models::AlternateFile, MediaFilePath, PathBuf)) -> i32 {
    max(alt.0.width, alt.0.height)
}

pub(crate) fn choose_alternate(
    mut alternates: Vec<(models::AlternateFile, MediaFilePath, PathBuf)>,
    size: i32,
) -> Option<(models::AlternateFile, MediaFilePath, PathBuf)> {
    if alternates.is_empty() {
        return None;
    }

    let mut chosen = alternates.swap_remove(0);

    for alternate in alternates {
        if (size - alt_size(&chosen)).abs() > (size - alt_size(&alternate)).abs() {
            chosen = alternate;
        }
    }

    Some(chosen)
}
