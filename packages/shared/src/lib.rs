#![deny(unreachable_pub)]
use std::{fmt::Debug, future::Future, result};

mod config;
mod error;

pub use config::{Config, ThumbnailConfig};
pub use error::Error;
use tracing::warn;

pub type Result<T = ()> = result::Result<T, Error>;

pub trait Ignorable {
    fn ignore(self);
    fn warn(self);
}

impl<E> Ignorable for result::Result<(), E>
where
    E: Debug,
{
    fn ignore(self) {}

    fn warn(self) {
        if let Err(e) = self {
            warn!(error=?e);
        }
    }
}

pub trait IgnorableFuture {
    fn ignore(self) -> impl Future<Output = ()>;
    fn warn(self) -> impl Future<Output = ()>;
}

impl<F, E> IgnorableFuture for F
where
    F: Future<Output = result::Result<(), E>>,
    E: Debug,
{
    async fn ignore(self) {
        self.await.ignore();
    }

    async fn warn(self) {
        self.await.warn();
    }
}
