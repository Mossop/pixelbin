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

pub use mail::{send_test_message, TestMessage};
pub use store::{
    db::{Isolation, StoreStats},
    file::FileStore,
    Store, StoreType,
};
pub use task_queue::worker;
pub use task_queue::Task;
pub(crate) use task_queue::TaskQueue;
