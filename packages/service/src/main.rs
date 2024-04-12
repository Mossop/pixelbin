use std::{env, error::Error, io, result, time::Duration};

use clap::{Args, Parser, Subcommand};
use dotenvy::dotenv;
use enum_dispatch::enum_dispatch;
use opentelemetry::{global, KeyValue};
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{
    propagation::TraceContextPropagator,
    trace::{self, Tracer},
    Resource,
};
#[cfg(feature = "webserver")]
use pixelbin::server::serve;
use pixelbin::{load_config, Config, Result, Store, Task};
use scoped_futures::ScopedFutureExt;
use tracing::{span, Instrument, Level, Span};
use tracing_subscriber::{
    layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Layer, Registry,
};

#[cfg(debug_assertions)]
const LOG_DEFAULTS: [(&str, Level); 1] = [("pixelbin", Level::TRACE)];

#[cfg(not(debug_assertions))]
const LOG_DEFAULTS: [(&str, Level); 1] = [("pixelbin", Level::INFO)];

async fn list_catalogs(store: &Store) -> Result<Vec<String>> {
    store
        .with_connection(|conn| conn.list_catalogs().scope_boxed())
        .await
}

#[derive(Args)]
struct Stats;

impl Runnable for Stats {
    fn span(&self) -> Span {
        span!(Level::INFO, "stats")
    }

    async fn run(&self, store: &Store) -> Result {
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
    fn span(&self) -> Span {
        span!(Level::INFO, "reprocess")
    }

    async fn run(&self, store: &Store) -> Result {
        let catalogs = list_catalogs(store).await?;

        for catalog in catalogs {
            store.queue_task(Task::ProcessMedia { catalog }).await;
        }

        Ok(())
    }
}

#[derive(Args)]
struct Verify;

impl Runnable for Verify {
    fn span(&self) -> Span {
        span!(Level::INFO, "verify")
    }

    async fn run(&self, store: &Store) -> Result {
        let catalogs = list_catalogs(store).await?;

        for catalog in catalogs.iter() {
            store
                .queue_task(Task::VerifyStorage {
                    catalog: catalog.clone(),
                })
                .await;
        }

        store.finish_tasks().await;

        // for catalog in catalogs.iter() {
        //     store
        //         .queue_task(Task::PruneMediaFiles {
        //             catalog: catalog.clone(),
        //         })
        //         .await;
        // }

        // store.finish_tasks().await;

        // for catalog in catalogs.iter() {
        //     store
        //         .queue_task(Task::UpdateSearches {
        //             catalog: catalog.clone(),
        //         })
        //         .await;
        // }

        Ok(())
    }
}

#[cfg(feature = "webserver")]
#[derive(Args)]
struct Serve;

#[cfg(feature = "webserver")]
impl Runnable for Serve {
    fn span(&self) -> Span {
        span!(Level::INFO, "service startup")
    }

    async fn run(&self, store: &Store) -> Result {
        serve(store).await
    }

    async fn exec(&self, config: Config) -> Result {
        let span = self.span();
        let store = async move {
            let store = Store::new(config, None).await?;
            store.queue_task(Task::ServerStartup).await;

            Result::<Store>::Ok(store)
        }
        .instrument(span)
        .await?;

        let result = self.run(&store).await;
        store.finish_tasks().await;
        result
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
    /// Reprocesses media where necessary.
    Reprocess,
    /// Verifies database and storage consistency.
    Verify,
}

#[enum_dispatch(Command)]
trait Runnable {
    fn span(&self) -> Span;

    async fn run(&self, store: &Store) -> Result;

    async fn exec(&self, config: Config) -> Result {
        let span = self.span();

        let span_id = span.id();
        async move {
            let store = Store::new(config, span_id).await?;
            let result = self.run(&store).await;
            store.finish_tasks().await;
            result
        }
        .instrument(span)
        .await
    }
}

#[derive(Parser)]
#[clap(author, version)]
struct CliArgs {
    #[clap(short, long)]
    config: Option<String>,

    #[clap(subcommand)]
    command: Command,
}

fn init_logging(telemetry: Option<&str>) -> result::Result<Option<Tracer>, Box<dyn Error>> {
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
            .with_tracer(tracer.clone())
            .with_filter(filter);

        registry.with(telemetry).init();

        Ok(Some(tracer))
    } else {
        registry.init();

        Ok(None)
    }
}

async fn inner_main() -> result::Result<(), Box<dyn Error>> {
    let args = CliArgs::parse();
    let config = load_config(args.config.as_deref())?;

    let tracer = match init_logging(config.telemetry_host.as_deref()) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("Failed to initialise logging: {e}");
            None
        }
    };

    let result = args.command.exec(config).await;

    if let Some(provider) = tracer.and_then(|t| t.provider()) {
        provider.force_flush();
    }

    Ok(result?)
}

#[tokio::main]
async fn main() {
    let _ = dotenv();

    if let Err(e) = inner_main().await {
        eprintln!("{e}");
    }
}
