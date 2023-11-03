use std::{env, error::Error, io, path::PathBuf, result, time::Duration};

use async_trait::async_trait;
use clap::{Args, Parser, Subcommand};
use enum_dispatch::enum_dispatch;
use opentelemetry::{
    sdk::{trace, Resource},
    KeyValue,
};
use opentelemetry_otlp::WithExportConfig;
use pixelbin_server::serve;
use pixelbin_shared::{load_config, Result};
use pixelbin_store::Store;
use pixelbin_tasks::{
    rebuild_searches, reprocess_all_media, verify_local_storage, verify_online_storage,
};
use scoped_futures::ScopedFutureExt;
use tracing::Level;
use tracing_subscriber::{
    layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Layer, Registry,
};

const LOG_DEFAULTS: [(&str, Level); 5] = [
    ("pixelbin_cli", Level::DEBUG),
    ("pixelbin_shared", Level::DEBUG),
    ("pixelbin_tasks", Level::DEBUG),
    ("pixelbin_store", Level::TRACE),
    ("pixelbin_server", Level::DEBUG),
];

#[derive(Args)]
struct Stats;

#[async_trait(?Send)]
impl Runnable for Stats {
    async fn run(self, store: Store) -> Result {
        store
            .in_transaction(|mut conn| {
                async move {
                    let stats = conn.stats().await?;
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
                .scope_boxed()
            })
            .await?;

        Ok(())
    }
}

#[derive(Args)]
struct Reprocess;

#[async_trait(?Send)]
impl Runnable for Reprocess {
    async fn run(self, store: Store) -> Result {
        reprocess_all_media(store).await
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

#[derive(Args)]
struct CheckDb;

#[async_trait(?Send)]
impl Runnable for CheckDb {
    async fn run(self, store: Store) -> Result {
        rebuild_searches(store).await
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
    /// Applies database migrations and verifies correctness.
    CheckDb,
    /// Reprocesses metadata from media.
    Reprocess,
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

fn init_logging(telemetry: Option<&str>) -> result::Result<(), Box<dyn Error>> {
    let filter = match env::var("RUST_LOG").as_deref() {
        Ok("") | Err(_) => {
            let mut filter = EnvFilter::new("warn");

            for (module, level) in LOG_DEFAULTS {
                filter = filter.add_directive(format!("{}={}", module, level).parse().unwrap());
            }

            filter
        }
        Ok(s) => EnvFilter::from_env(s),
    };

    let formatter = tracing_subscriber::fmt::layer()
        .with_ansi(true)
        .pretty()
        .with_writer(io::stderr)
        .with_filter(filter);

    let registry = Registry::default().with(formatter);

    if let Some(telemetry_host) = telemetry {
        let tracer =
            opentelemetry_otlp::new_pipeline()
                .tracing()
                .with_exporter(
                    opentelemetry_otlp::new_exporter()
                        .tonic()
                        .with_endpoint(telemetry_host)
                        .with_timeout(Duration::from_secs(3)),
                )
                .with_trace_config(trace::config().with_resource(Resource::new(vec![
                    KeyValue::new("service.name", "pixelbin"),
                ])))
                .install_batch(opentelemetry::runtime::Tokio)?;

        let mut filter = EnvFilter::new("warn");

        for (module, _) in LOG_DEFAULTS {
            filter = filter.add_directive(format!("{}=trace", module).parse().unwrap());
        }

        let telemetry = tracing_opentelemetry::layer()
            .with_exception_fields(true)
            .with_tracked_inactivity(true)
            .with_tracer(tracer)
            .with_filter(filter);

        registry.with(telemetry).init();
    } else {
        registry.init();
    }

    Ok(())
}

async fn inner_main() -> result::Result<(), Box<dyn Error>> {
    let args = CliArgs::parse();
    let config = load_config(args.config.as_deref())?;

    if let Err(e) = init_logging(config.telemetry.as_deref()) {
        eprintln!("Failed to initialise logging: {e}");
    }

    let store = Store::new(config).await?;

    args.command.run(store).await?;

    Ok(())
}

#[tokio::main]
async fn main() {
    if let Err(e) = inner_main().await {
        eprintln!("{e}");
    }
}
