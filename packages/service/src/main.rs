use std::{env, error::Error, io, result, time::Duration};

use clap::{Args, Parser, Subcommand};
use enum_dispatch::enum_dispatch;
use opentelemetry::{global, KeyValue};
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{propagation::TraceContextPropagator, trace, Resource};
#[cfg(feature = "webserver")]
use pixelbin::server::serve;
use pixelbin::{
    load_config,
    tasks::{prune_catalogs, rebuild_searches, reprocess_all_media, sanity_check_catalogs},
    Result, Store,
};
use scoped_futures::ScopedFutureExt;
use tracing::{instrument, Level};
use tracing_subscriber::{
    layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Layer, Registry,
};

#[cfg(debug_assertions)]
const LOG_DEFAULTS: [(&str, Level); 1] = [("pixelbin", Level::TRACE)];

#[cfg(not(debug_assertions))]
const LOG_DEFAULTS: [(&str, Level); 1] = [("pixelbin", Level::INFO)];

#[derive(Args)]
struct Stats;

impl Runnable for Stats {
    #[instrument(name = "stats", skip_all)]
    async fn run(self, store: Store) -> Result {
        store
            .with_connection(|conn| {
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

impl Runnable for Reprocess {
    #[instrument(name = "reprocess", skip_all)]
    async fn run(self, store: Store) -> Result {
        reprocess_all_media(store).await
    }
}

#[derive(Args)]
struct Prune;

impl Runnable for Prune {
    #[instrument(name = "prune", skip_all)]
    async fn run(self, store: Store) -> Result {
        prune_catalogs(store).await
    }
}

#[derive(Args)]
struct Verify;

impl Runnable for Verify {
    #[instrument(name = "verify", skip_all)]
    async fn run(self, store: Store) -> Result {
        sanity_check_catalogs(store).await
    }
}

#[cfg(feature = "webserver")]
#[derive(Args)]
struct Serve;

#[cfg(feature = "webserver")]
impl Runnable for Serve {
    #[instrument(name = "serve", skip_all)]
    async fn run(self, store: Store) -> Result {
        serve(store).await
    }
}

#[derive(Args)]
struct CheckDb;

impl Runnable for CheckDb {
    #[instrument(name = "check-db", skip_all)]
    async fn run(self, store: Store) -> Result {
        rebuild_searches(store).await
    }
}

#[enum_dispatch]
#[derive(Subcommand)]
enum Command {
    /// Runs the server.
    #[cfg(feature = "webserver")]
    Serve,
    /// List some basic stats about objects in the database.
    Stats,
    /// Applies database migrations and verifies correctness.
    CheckDb,
    /// Reprocesses metadata from media.
    Reprocess,
    /// Verifies database and storage consistency.
    Verify,
    /// Prunes old versions of media.
    Prune,
}

#[enum_dispatch(Command)]
trait Runnable {
    async fn run(self, store: Store) -> Result;
}

#[derive(Parser)]
#[clap(author, version)]
struct CliArgs {
    #[clap(short, long)]
    config: Option<String>,

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
        Ok(_) => EnvFilter::from_env("RUST_LOG"),
    };

    let formatter = tracing_subscriber::fmt::layer()
        .with_ansi(true)
        .pretty()
        .with_writer(io::stderr)
        .with_filter(filter);

    let registry = Registry::default().with(formatter);

    if let Some(telemetry_host) = telemetry {
        global::set_text_map_propagator(TraceContextPropagator::new());

        let tracer =
            opentelemetry_otlp::new_pipeline()
                .tracing()
                .with_exporter(
                    opentelemetry_otlp::new_exporter()
                        .tonic()
                        .with_endpoint(format!("http://{telemetry_host}:4317"))
                        .with_timeout(Duration::from_secs(3)),
                )
                .with_trace_config(trace::config().with_resource(Resource::new(vec![
                    KeyValue::new("service.name", "pixelbin-api"),
                ])))
                .install_batch(opentelemetry_sdk::runtime::Tokio)?;

        let mut filter = EnvFilter::new("warn");

        for (module, _) in LOG_DEFAULTS {
            filter = filter.add_directive(format!("{}=trace", module).parse().unwrap());
        }

        let telemetry = tracing_opentelemetry::layer()
            .with_error_fields_to_exceptions(true)
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

    if let Err(e) = init_logging(config.telemetry_host.as_deref()) {
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
