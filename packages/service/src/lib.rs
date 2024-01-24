#![deny(unreachable_pub)]

mod metadata;
#[cfg(feature = "webserver")]
pub mod server;
mod shared;
mod store;
pub mod tasks;

use std::path::Path;

use metadata::parse_metadata;
pub use shared::{
    config::Config,
    error::{Error, Result},
    load_config,
};
pub use store::{FileStore, Store};

pub async fn test_metadata_parsing(path: &Path) -> Result {
    let metadata = parse_metadata(path).await?;

    Ok(())
}
