#![deny(unreachable_pub)]
pub use pixelbin_shared::{Config, Error, Result};

mod mail;
mod metadata;
#[cfg(feature = "webserver")]
pub mod server;
mod shared;
mod store;
mod task_queue;
#[cfg(feature = "worker")]
pub mod worker;

pub use mail::{send_test_message, TestMessage};
pub use store::{
    db::{Isolation, StoreStats},
    file::FileStore,
    Store,
};
pub use task_queue::Task;
pub(crate) use task_queue::TaskQueue;
