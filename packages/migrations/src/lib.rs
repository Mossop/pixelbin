#![deny(unreachable_pub)]
use std::{collections::BTreeMap, ops::DerefMut, path::PathBuf};

use chrono::{DateTime, Utc};
use include_dir::{include_dir, Dir};
use pixelbin_shared::{Error, Result};
use sqlx::{Acquire, Executor, FromRow, PgConnection, Postgres, Transaction};

static MIGRATIONS: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/migrations");

const MIGRATION_TABLE: &str = r#""__pixelbin_migrations""#;

#[derive(Clone, Copy)]
pub enum MigrationType {
    Up,
    Down,
    UpDown,
}

#[derive(Clone)]
pub struct Migration {
    path: PathBuf,
    version: String,
    name: String,
    migration_type: MigrationType,
    applied: Option<DateTime<Utc>>,
}

impl PartialEq for Migration {
    fn eq(&self, other: &Self) -> bool {
        self.version == other.version
    }
}

#[derive(Clone, Copy)]
pub enum Operation {
    Up,
    Down,
}

pub enum Phase<'a> {
    Start,
    Complete,
    Error(&'a Error),
}

impl Operation {
    async fn run<'a>(
        self,
        migration: &mut Migration,
        tx: &mut Transaction<'a, Postgres>,
    ) -> Result {
        match self {
            Self::Up => {
                if let Some(sql) = migration.up_sql() {
                    sqlx::raw_sql(sql).execute(tx.deref_mut()).await?;
                    migration.applied = sqlx::query_scalar(
                        &format!("INSERT INTO {MIGRATION_TABLE} (version, applied) VALUES ($1, CURRENT_TIMESTAMP) RETURNING applied"),
                    )
                    .bind(migration.version.clone())
                    .fetch_one(tx.deref_mut())
                    .await?;
                }
            }
            Self::Down => {
                if let Some(sql) = migration.down_sql() {
                    sqlx::raw_sql(sql).execute(tx.deref_mut()).await?;
                    sqlx::query(&format!("DELETE FROM {MIGRATION_TABLE} WHERE version=$1"))
                        .bind(migration.version.clone())
                        .execute(tx.deref_mut())
                        .await?;
                    migration.applied = None;
                }
            }
        }

        Ok(())
    }
}

struct OperationQueue(Vec<(Operation, Migration)>);

impl OperationQueue {
    fn new() -> Self {
        Self(Vec::new())
    }

    fn push(&mut self, operation: Operation, migration: Migration) {
        self.0.push((operation, migration))
    }

    async fn apply<'a, L>(self, tx: &mut Transaction<'a, Postgres>, mut listener: L) -> Result
    where
        L: FnMut(Operation, Phase<'_>, &Migration),
    {
        for (operation, mut migration) in self.0 {
            listener(operation, Phase::Start, &migration);
            match operation.run(&mut migration, tx).await {
                Ok(_) => {
                    listener(operation, Phase::Complete, &migration);
                }
                Err(e) => {
                    listener(operation, Phase::Error(&e), &migration);
                    return Err(e);
                }
            }
        }

        Ok(())
    }
}

impl Migration {
    pub fn version(&self) -> &str {
        self.version.as_str()
    }

    pub fn name(&self) -> &str {
        self.name.as_str()
    }

    pub fn applied(&self) -> Option<DateTime<Utc>> {
        self.applied
    }

    fn up_sql(&self) -> Option<&str> {
        match self.migration_type {
            MigrationType::Up | MigrationType::UpDown => Some(
                MIGRATIONS
                    .get_file(self.path.join("up.sql"))?
                    .contents_utf8()?,
            ),
            _ => None,
        }
    }

    fn down_sql(&self) -> Option<&str> {
        match self.migration_type {
            MigrationType::Down | MigrationType::UpDown => Some(
                MIGRATIONS
                    .get_file(self.path.join("down.sql"))?
                    .contents_utf8()?,
            ),
            _ => None,
        }
    }
}

#[derive(FromRow)]
struct AppliedMigration {
    version: String,
    applied: DateTime<Utc>,
}

pub struct Migrator {
    migrations: BTreeMap<String, Migration>,
}

impl Migrator {
    pub async fn new(connection: &mut PgConnection) -> Result<Self> {
        let migrations = MIGRATIONS
            .dirs()
            .filter_map(|dir| {
                let migration_type = match (
                    dir.get_file(dir.path().join("up.sql")).is_some(),
                    dir.get_file(dir.path().join("down.sql")).is_some(),
                ) {
                    (true, true) => MigrationType::UpDown,
                    (true, false) => MigrationType::Up,
                    (false, true) => MigrationType::Down,
                    _ => {
                        eprintln!("Missing scripts");
                        return None;
                    }
                };

                let dir_name = dir.path().file_name()?.to_str()?;
                let (version, name) = dir_name.split_once('_')?;
                let migration_version = version.replace('-', "");

                Some((
                    migration_version.clone(),
                    Migration {
                        path: dir.path().to_owned(),
                        applied: None,
                        version: migration_version,
                        name: name.to_owned(),
                        migration_type,
                    },
                ))
            })
            .collect();

        let mut migrator = Self { migrations };
        migrator.setup(connection).await?;

        let mut tx = connection.begin().await?;
        migrator.update_state(&mut *tx).await?;
        tx.commit().await?;

        Ok(migrator)
    }

    async fn setup(&mut self, connection: &mut PgConnection) -> Result {
        sqlx::raw_sql(&format!(
            r#"
            CREATE TABLE IF NOT EXISTS {MIGRATION_TABLE}
                (version VARCHAR(20) NOT NULL PRIMARY KEY, applied TIMESTAMPTZ NOT NULL)
            "#
        ))
        .execute(&mut *connection)
        .await?;

        match sqlx::query(&format!(
            r#"
            INSERT INTO {MIGRATION_TABLE} (version, applied)
            SELECT version, run_on AT TIME ZONE 'UTC'
                FROM "__diesel_schema_migrations"
                WHERE version <> $1
            "#,
        ))
        .bind("00000000000000")
        .execute(&mut *connection)
        .await
        {
            Ok(_) => {
                sqlx::raw_sql("DROP FUNCTION IF EXISTS diesel_manage_updated_at(_tbl regclass)")
                    .execute(&mut *connection)
                    .await?;
                sqlx::raw_sql("DROP FUNCTION IF EXISTS diesel_set_updated_at()")
                    .execute(&mut *connection)
                    .await?;
                sqlx::raw_sql(r#"DROP TABLE IF EXISTS "__diesel_schema_migrations""#)
                    .execute(&mut *connection)
                    .await?;
            }
            Err(_e) => {
                // Ignore missing diesel data
            }
        }

        Ok(())
    }

    async fn update_state<'a, E>(&mut self, executor: E) -> Result
    where
        E: Executor<'a, Database = Postgres>,
    {
        for migration in self.migrations.values_mut() {
            migration.applied = None;
        }

        let applied: Vec<AppliedMigration> =
            sqlx::query_as(&format!(r#"SELECT * FROM {MIGRATION_TABLE} FOR UPDATE"#))
                .fetch_all(executor)
                .await?;

        for migration in applied {
            if let Some(known) = self.migrations.get_mut(&migration.version) {
                known.applied = Some(migration.applied);
            }
        }

        Ok(())
    }

    pub async fn list<'a, E>(&mut self, executor: E) -> Result<Vec<Migration>>
    where
        E: Executor<'a, Database = Postgres>,
    {
        self.update_state(executor).await?;

        Ok(self.migrations.values().cloned().collect())
    }

    /// Applies migrations until the given migration (or the all migrations) are applied.
    pub async fn apply<L>(
        &mut self,
        connection: &mut PgConnection,
        target: Option<Migration>,
        listener: L,
    ) -> Result
    where
        L: FnMut(Operation, Phase<'_>, &Migration),
    {
        let mut tx = connection.begin().await?;
        self.update_state(&mut *tx).await?;

        let mut queue = OperationQueue::new();
        for migration in self.migrations.values() {
            let is_target = if let Some(ref target) = target {
                target == migration
            } else {
                false
            };

            if migration.applied.is_none() {
                queue.push(Operation::Up, migration.clone());
            }

            if is_target {
                break;
            }
        }

        queue.apply(&mut tx, listener).await?;
        tx.commit().await?;

        Ok(())
    }

    /// Rolls back migrations until the given migration (or the most recently applied migration)
    /// is no longer applied.
    pub async fn undo<L>(
        &mut self,
        connection: &mut PgConnection,
        target: Option<Migration>,
        listener: L,
    ) -> Result
    where
        L: FnMut(Operation, Phase<'_>, &Migration),
    {
        let mut tx = connection.begin().await?;
        self.update_state(&mut *tx).await?;

        let mut queue = OperationQueue::new();
        let mut values = self.migrations.values();
        while let Some(migration) = values.next_back() {
            let is_target = if let Some(ref target) = target {
                target == migration
            } else {
                migration.applied.is_some()
            };

            if migration.applied.is_some() {
                queue.push(Operation::Down, migration.clone());
            }

            if is_target {
                break;
            }
        }

        queue.apply(&mut tx, listener).await?;
        tx.commit().await?;

        Ok(())
    }

    /// Re-applies the given migration or the most recently applied migration.
    /// If the given migration is not applied then this will do nothing.
    pub async fn redo<L>(
        &mut self,
        connection: &mut PgConnection,
        target: Option<Migration>,
        listener: L,
    ) -> Result
    where
        L: FnMut(Operation, Phase<'_>, &Migration),
    {
        let mut tx = connection.begin().await?;
        self.update_state(&mut *tx).await?;

        let mut queue = OperationQueue::new();
        let mut values = self.migrations.values();
        while let Some(migration) = values.next_back() {
            let is_target = if let Some(ref target) = target {
                target == migration
            } else {
                migration.applied.is_some()
            };

            if migration.applied.is_some() {
                queue.push(Operation::Down, migration.clone());
            }

            if is_target {
                if migration.applied.is_some() {
                    queue.push(Operation::Up, migration.clone());
                }

                break;
            }
        }

        queue.apply(&mut tx, listener).await?;
        tx.commit().await?;

        Ok(())
    }

    /// Applies the next unapplied migration.
    pub async fn next<L>(
        &mut self,
        connection: &mut PgConnection,
        listener: L,
    ) -> Result<Option<Migration>>
    where
        L: FnMut(Operation, Phase<'_>, &Migration),
    {
        let mut tx = connection.begin().await?;
        self.update_state(&mut *tx).await?;

        if let Some(migration) = self.migrations.values().find(|m| m.applied.is_none()) {
            let mut queue = OperationQueue::new();

            queue.push(Operation::Up, migration.clone());
            queue.apply(&mut tx, listener).await?;
            tx.commit().await?;

            Ok(self.migrations.get(&migration.version).cloned())
        } else {
            tx.commit().await?;
            Ok(None)
        }
    }
}
