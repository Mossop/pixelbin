use std::{env, io, path::PathBuf};

use async_trait::async_trait;
use clap::{Args, Parser, Subcommand};
use enum_dispatch::enum_dispatch;
use pixelbin_server::serve;
use pixelbin_shared::{load_config, Result};
use pixelbin_store::{DbQueries, Store};
use pixelbin_tasks::{verify_local_storage, verify_online_storage};

#[derive(Args)]
struct Stats;

#[async_trait(?Send)]
impl Runnable for Stats {
    async fn run(self, mut store: Store) -> Result {
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

#[derive(Args)]
struct VerifyLocal;

#[async_trait(?Send)]
impl Runnable for VerifyLocal {
    async fn run(self, store: Store) -> Result {
        verify_local_storage(store).await
    }
}

#[derive(Args)]
struct VerifyOnline;

#[async_trait(?Send)]
impl Runnable for VerifyOnline {
    async fn run(self, store: Store) -> Result {
        verify_online_storage(store).await
    }
}

#[derive(Args)]
struct Serve;

#[async_trait(?Send)]
impl Runnable for Serve {
    async fn run(self, store: Store) -> Result {
        serve(store).await
    }
}

#[enum_dispatch]
#[derive(Subcommand)]
enum Command {
    /// Runs the server.
    Serve,
    /// List some basic stats about objects in the database.
    Stats,
    /// Verifies that the expected locally stored files are present.
    VerifyLocal,
    /// Verifies that the expected online stored files are present.
    VerifyOnline,
}

#[async_trait(?Send)]
#[enum_dispatch(Command)]
pub trait Runnable {
    async fn run(self, store: Store) -> Result;
}

#[derive(Parser)]
#[clap(author, version)]
struct CliArgs {
    #[clap(short, long)]
    config: Option<PathBuf>,

    #[clap(subcommand)]
    command: Command,
}

async fn inner_main(args: CliArgs) -> Result {
    let config = load_config(args.config.as_deref())?;
    let store = Store::new(config).await?;

    args.command.run(store).await
}

#[tokio::main]
async fn main() {
    let args = CliArgs::parse();

    let log_filter =
        env::var("RUST_LOG").unwrap_or_else(|_| "pixelbin_cli=trace,pixelbin_shared=trace,pixelbin_tasks=trace,pixelbin_store=trace,pixelbin_server=trace,warn".to_string());

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
