mod error;

use std::{env, io};

use async_trait::async_trait;
use clap::{Args, Parser, Subcommand};
use enum_dispatch::enum_dispatch;
use pixelbin_store::Store;

use error::Result;

#[derive(Args)]
struct Stats;

#[async_trait]
impl Runnable for Stats {
    async fn run(self, store: Store) -> Result {
        let stats = store.stats().await?;
        println!("Users:           {}", stats.users);
        println!("Catalogs:        {}", stats.catalogs);
        println!("Albums:          {}", stats.albums);
        println!("Tags:            {}", stats.tags);
        println!("People:          {}", stats.people);
        println!("Media:           {}", stats.media);
        println!("Files:           {}", stats.files);
        println!("Alternate files: {}", stats.alternate_files);

        Ok(())
    }
}

#[enum_dispatch]
#[derive(Subcommand)]
enum Command {
    Stats,
}

#[async_trait]
#[enum_dispatch(Command)]
pub trait Runnable {
    async fn run(self, store: Store) -> Result;
}

#[derive(Parser)]
#[clap(author, version)]
struct CliArgs {
    #[clap(subcommand)]
    command: Command,
}

async fn inner_main(args: CliArgs) -> Result {
    let store = Store::new("postgres://pixelbin:pixelbin@localhost/pixelbin-prod").await?;

    args.command.run(store).await
}

#[tokio::main]
async fn main() {
    let args = CliArgs::parse();

    let log_filter =
        env::var("RUST_LOG").unwrap_or_else(|_| "pixelbin_store=trace,warn".to_string());

    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(log_filter)
        .with_ansi(true)
        .pretty()
        .with_writer(io::stderr)
        .finish();
    if let Err(e) = tracing::subscriber::set_global_default(subscriber) {
        eprintln!("Unable to set global default subscriber: {e}");
    }

    if let Err(e) = inner_main(args).await {
        tracing::error!("{}", e);
    }
}
