use std::{
    error::Error,
    io::{self},
    process::ExitCode,
    result,
    time::Duration,
};

use clap::{Args, Parser, Subcommand};
use dotenvy::dotenv;
use enum_dispatch::enum_dispatch;
use opentelemetry::{global, trace::TracerProvider as _, KeyValue};
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{
    propagation::TraceContextPropagator,
    trace::{self, TracerProvider},
    Resource,
};
use pixelbin::{server::serve, Config, Result, Store, StoreStats, Task};
use tokio::runtime::Builder;
use tracing::{span, Instrument, Level, Span};
use tracing_subscriber::{
    filter::Targets, layer::SubscriberExt, util::SubscriberInitExt, Layer, Registry,
};

#[cfg(not(debug_assertions))]
const STACK_SIZE: usize = 10 * 1024 * 1024;
#[cfg(debug_assertions)]
const STACK_SIZE: usize = 20 * 1024 * 1024;

async fn list_catalogs(store: &Store) -> Result<Vec<String>> {
    store.pooled().list_catalogs().await
}

#[derive(Args)]
struct Stats;

impl Runnable for Stats {
    fn span(&self) -> Span {
        span!(Level::INFO, "stats")
    }

    async fn run(&self, store: &Store) -> Result {
        let mut conn = store.pooled();
        let stats = StoreStats::stats(&mut conn).await?;
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
struct Verify {
    #[clap(long)]
    no_delete: bool,
}

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
                    delete_files: !self.no_delete,
                })
                .await;
        }

        store.finish_tasks().await;

        for catalog in catalogs.iter() {
            store
                .queue_task(Task::PruneMediaFiles {
                    catalog: catalog.clone(),
                })
                .await;
        }

        for catalog in catalogs.iter() {
            store
                .queue_task(Task::PruneMediaItems {
                    catalog: catalog.clone(),
                })
                .await;
        }

        store.finish_tasks().await;

        for catalog in catalogs.iter() {
            store
                .queue_task(Task::UpdateSearches {
                    catalog: catalog.clone(),
                })
                .await;
        }

        Ok(())
    }
}

#[derive(Args)]
struct Serve;

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

fn init_logging(telemetry: Option<&str>) -> result::Result<Option<TracerProvider>, Box<dyn Error>> {
    // let filter = EnvFilter::from_default_env().or(TracingFilter {});

    let default_level = if cfg!(debug_assertions) {
        Level::DEBUG
    } else {
        Level::WARN
    };

    let formatter = tracing_subscriber::fmt::layer()
        .with_ansi(true)
        .pretty()
        .with_writer(io::stderr)
        .with_filter(
            Targets::new()
                .with_target("pixelbin", default_level)
                .with_target("pixelbin_shared", default_level)
                .with_target("pixelbin_migrations", default_level),
        );

    let registry = Registry::default().with(formatter);

    if let Some(telemetry_host) = telemetry {
        global::set_text_map_propagator(TraceContextPropagator::new());

        let tracer_provider = opentelemetry_otlp::new_pipeline()
            .tracing()
            .with_exporter(
                opentelemetry_otlp::new_exporter()
                    .http()
                    .with_protocol(opentelemetry_otlp::Protocol::HttpBinary)
                    .with_endpoint(telemetry_host)
                    .with_timeout(Duration::from_secs(3)),
            )
            .with_trace_config(trace::Config::default().with_resource(Resource::new(vec![
                KeyValue::new("service.name", "pixelbin-api"),
            ])))
            .install_batch(opentelemetry_sdk::runtime::Tokio)?;

        let tracer = tracer_provider.tracer("pixelbin-api");

        let filter = Targets::new()
            .with_target("pixelbin", Level::TRACE)
            .with_target("pixelbin_shared", Level::TRACE)
            .with_target("pixelbin_migrations", Level::TRACE)
            .with_target("sqlx::query", Level::TRACE);

        let telemetry = tracing_opentelemetry::layer()
            .with_error_fields_to_exceptions(true)
            .with_tracked_inactivity(true)
            .with_tracer(tracer)
            .with_filter(filter);

        registry.with(telemetry).init();

        Ok(Some(tracer_provider))
    } else {
        registry.init();

        Ok(None)
    }
}

async fn inner_main() -> result::Result<(), Box<dyn Error>> {
    let args = CliArgs::parse();
    let config = Config::load(args.config.as_deref())?;

    let provider = match init_logging(config.telemetry_host.as_deref()) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("Failed to initialise logging: {e}");
            None
        }
    };

    let result = args.command.exec(config).await;

    if let Some(provider) = provider {
        provider.force_flush();
    }

    Ok(result?)
}

fn main() -> ExitCode {
    let _ = dotenv();

    let runtime = Builder::new_multi_thread()
        .thread_stack_size(STACK_SIZE)
        .enable_all()
        .build()
        .unwrap();

    if let Err(e) = runtime.block_on(inner_main()) {
        eprintln!("{e}");
        ExitCode::FAILURE
    } else {
        ExitCode::SUCCESS
    }
}
