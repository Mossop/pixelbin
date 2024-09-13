use std::{error, process::ExitCode, result};

use chrono_humanize::HumanTime;
use clap::{Args, Parser, Subcommand};
use console::style;
use dotenvy::dotenv;
use enum_dispatch::enum_dispatch;
use pixelbin_migrations::{Migration, Migrator, Operation, Phase};
use pixelbin_shared::{Config, Error, Result};
use sqlx::{Connection, PgConnection};
use tokio::runtime::Builder;

async fn find_migrator(
    migrator: &mut Migrator,
    conn: &mut PgConnection,
    version: &Option<String>,
) -> Result<Option<Migration>> {
    if let Some(version) = version {
        let migrators = migrator.list(conn).await?;

        for migrator in migrators {
            if migrator.version() == version {
                return Ok(Some(migrator));
            }
        }

        Err(Error::MigrationError {
            message: format!("Unknown migration version: {}", version),
        })
    } else {
        Ok(None)
    }
}

fn listener(operation: Operation, phase: Phase<'_>, migration: &Migration) {
    match (operation, phase) {
        (Operation::Up, Phase::Start) => {
            print!(
                "Applying {} (version {}) ... ",
                migration.name(),
                migration.version()
            );
        }
        (Operation::Down, Phase::Start) => {
            print!(
                "Rolling back {} (version {}) ... ",
                migration.name(),
                migration.version()
            );
        }
        (_, Phase::Complete) => {
            println!("{}", style("Complete").green());
        }
        (_, Phase::Error(_)) => {
            println!("{}", style("Error").red());
        }
    }
}

#[derive(Args)]
struct Next {}

impl Runnable for Next {
    async fn run(&self, config: Config) -> Result {
        let mut conn = PgConnection::connect(&config.database_url).await?;
        let mut migrator = Migrator::new(&mut conn).await?;

        migrator.next(&mut conn, listener).await?;

        Ok(())
    }
}

#[derive(Args)]
struct Undo {
    /// Version to rollback
    version: Option<String>,
}

impl Runnable for Undo {
    async fn run(&self, config: Config) -> Result {
        let mut conn = PgConnection::connect(&config.database_url).await?;
        let mut migrator = Migrator::new(&mut conn).await?;

        let migration = find_migrator(&mut migrator, &mut conn, &self.version).await?;
        migrator.undo(&mut conn, migration, listener).await?;

        Ok(())
    }
}

#[derive(Args)]
struct Redo {
    /// Version to redo
    version: Option<String>,
}

impl Runnable for Redo {
    async fn run(&self, config: Config) -> Result {
        let mut conn = PgConnection::connect(&config.database_url).await?;
        let mut migrator = Migrator::new(&mut conn).await?;

        let migration = find_migrator(&mut migrator, &mut conn, &self.version).await?;
        migrator.redo(&mut conn, migration, listener).await?;

        Ok(())
    }
}

#[derive(Args)]
struct Apply {
    /// Version to apply to
    version: Option<String>,
}

impl Runnable for Apply {
    async fn run(&self, config: Config) -> Result {
        let mut conn = PgConnection::connect(&config.database_url).await?;
        let mut migrator = Migrator::new(&mut conn).await?;

        let migration = find_migrator(&mut migrator, &mut conn, &self.version).await?;
        migrator.apply(&mut conn, migration, listener).await?;

        Ok(())
    }
}

#[derive(Args)]
struct List {}

impl Runnable for List {
    async fn run(&self, config: Config) -> Result {
        let mut conn = PgConnection::connect(&config.database_url).await?;
        let mut migrator = Migrator::new(&mut conn).await?;

        println!("{}", style("version              name").dim());
        println!(
            "{}",
            style("---------------------------------------------------------------------").dim()
        );

        for migration in migrator.list(&mut conn).await? {
            if let Some(applied) = migration.applied() {
                let human = HumanTime::from(applied);

                println!(
                    "{}",
                    style(format!(
                        "{:20} {:25} (applied {human})",
                        migration.version(),
                        migration.name(),
                    ))
                    .bright()
                    .white()
                );
            } else {
                println!(
                    "{}",
                    style(format!(
                        "{:20} {:25}",
                        migration.version(),
                        migration.name()
                    ))
                    .dim()
                );
            }
        }

        Ok(())
    }
}

#[enum_dispatch]
#[derive(Subcommand)]
enum Command {
    /// Applies the available migrations.
    Apply,
    /// Applies the next migration.
    Next,
    /// Undoes the most recent migration.
    Undo,
    /// Redoes the most recent migration.
    Redo,
    /// Lists available migrations.
    List,
}

#[enum_dispatch(Command)]
trait Runnable {
    async fn run(&self, config: Config) -> Result;
}

#[derive(Parser)]
#[clap(author, version)]
struct CliArgs {
    #[clap(short, long)]
    config: Option<String>,

    #[clap(subcommand)]
    command: Command,
}

async fn inner_main() -> result::Result<(), Box<dyn error::Error>> {
    let args = CliArgs::parse();
    let config = Config::load(args.config.as_deref())?;

    args.command.run(config).await?;

    Ok(())
}

fn main() -> ExitCode {
    let _ = dotenv();

    let runtime = Builder::new_multi_thread()
        .thread_stack_size(10 * 1024 * 1024)
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
