#![deny(unreachable_pub)]
pub use pixelbin_shared::{Config, Error, Result};

mod mail;
mod metadata;
#[cfg(feature = "webserver")]
pub mod server;
mod shared;
mod store;
mod task_queue;

pub use store::{
    db::{Isolation, StoreStats},
    file::FileStore,
    Store,
};
pub use task_queue::Task;
pub(crate) use task_queue::TaskQueue;
