#![deny(unreachable_pub)]
#![allow(clippy::result_large_err)]
pub use pixelbin_shared::{Config, Error, Result};

mod mail;
mod metadata;
#[cfg(feature = "webserver")]
pub mod server;
mod shared;
mod store;
pub mod task_queue;

pub use mail::{TestMessage, send_test_message};
pub use store::{
    Store, StoreType,
    db::{Isolation, StoreStats},
    file::FileStore,
};
pub use task_queue::Task;
pub(crate) use task_queue::TaskQueue;
