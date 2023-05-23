use std::{env, io};

// use clap::Parser;
use pixelbin_store::Store;

// #[derive(Parser)]
// #[clap(author, version)]
// struct Args {}

#[tokio::main]
async fn main() {
    // let args = Args::parse();

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

    let store = Store::new("postgres://pixelbin:pixelbin@localhost/pixelbin-prod")
        .await
        .unwrap();
    let stats = store.stats().await.unwrap();
    println!("{stats:#?}");
}
