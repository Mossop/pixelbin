use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};

use async_channel::{unbounded, Receiver, Sender};
use chrono::{Datelike, Local, NaiveDate, Timelike};
use opentelemetry::{global, trace::TraceContextExt};
use pixelbin_shared::Ignorable;
use strum_macros::IntoStaticStr;
use tokio::{sync::Notify, time::sleep};
use tracing::{field, span, span::Id, Instrument, Level, Span};
use tracing_opentelemetry::OpenTelemetrySpanExt;

use crate::{
    shared::{record_result, DEFAULT_STATUS},
    store::models,
    task_queue::{
        maintenance::{
            delete_alternate_files, prune_media_files, prune_media_items, server_startup,
            trigger_media_tasks, update_searches, verify_storage,
        },
        media::{process_media_file, prune_deleted_media},
    },
    Result, Store,
};

mod maintenance;
mod media;
mod opcache;

#[derive(Debug, IntoStaticStr)]
pub enum Task {
    /// Queues work that may have been pending at the last shutdown.
    ServerStartup,
    /// Cleans up deleted media items.
    DeleteMedia { catalog: String },
    /// Updates searches based on changes to media items.
    UpdateSearches { catalog: String },
    /// Checks storage for missing files and prunes unexpected files.
    VerifyStorage { catalog: String, delete_files: bool },
    /// Prunes superceded media files.
    PruneMediaFiles { catalog: String },
    /// Prunes empty media items (no media files present).
    PruneMediaItems { catalog: String },
    /// Triggers any tasks required to complete media files.
    ProcessMedia { catalog: String },
    /// Triggers any tasks required to complete a media file.
    ProcessMediaFile { media_file: String },
    /// Deletes the no longer required alternate files.
    DeleteAlternateFiles { alternate_files: Vec<String> },
}

impl Task {
    async fn run(&self, store: Store) -> Result {
        match self {
            Task::ServerStartup => server_startup(store).await,
            Task::DeleteMedia { catalog } => prune_deleted_media(store, catalog).await,
            Task::UpdateSearches { catalog } => update_searches(store, catalog).await,
            Task::VerifyStorage {
                catalog,
                delete_files,
            } => verify_storage(store, catalog, *delete_files).await,
            Task::PruneMediaFiles { catalog } => prune_media_files(store, catalog).await,
            Task::PruneMediaItems { catalog } => prune_media_items(store, catalog).await,
            Task::ProcessMedia { catalog } => trigger_media_tasks(store, catalog).await,
            Task::ProcessMediaFile { media_file } => process_media_file(store, media_file).await,
            Task::DeleteAlternateFiles { alternate_files } => {
                delete_alternate_files(store, alternate_files).await
            }
        }
    }
}

fn next_tick() -> Duration {
    let now = Local::now();
    let seconds = 60 - now.second();
    let minutes = 60 - now.minute();

    Duration::from_secs(((minutes * 60) + seconds) as u64)
}

type TaskMessage = (Task, HashMap<String, String>);

fn partition(set: &[String], size: u32, offset: u32) -> Vec<&str> {
    set.iter()
        .filter_map(|s| {
            if s.is_empty() {
                return None;
            }

            let bytes = s.as_bytes();
            let char = bytes[bytes.len() - 1];

            // value is 0..61
            let value = match char {
                // A .. Z
                65..=90 => char - 65,
                // a .. z
                97..=122 => (char - 97) + 26,
                // 0 .. 9
                48..=57 => (char - 48) + 26 + 26,
                _ => return None,
            } as u32;

            // Imperfect but good enough
            if (value % size) == offset {
                Some(s.as_str())
            } else {
                None
            }
        })
        .collect()
}

#[derive(Clone, Debug)]
pub(crate) struct TaskQueue {
    notify: Arc<Notify>,
    pending: Arc<AtomicUsize>,
    sender: Sender<TaskMessage>,
    receiver: Receiver<TaskMessage>,
}

pub(crate) struct TaskLoop {
    store: Store,
    notify: Arc<Notify>,
    pending: Arc<AtomicUsize>,
    receiver: Receiver<TaskMessage>,
}

impl TaskLoop {
    fn spawn(queue: &TaskQueue, store: &Store, parent_span: Option<Id>) {
        let this = TaskLoop {
            store: store.clone(),
            notify: queue.notify.clone(),
            pending: queue.pending.clone(),
            receiver: queue.receiver.clone(),
        };

        tokio::spawn(this.task_loop(parent_span.clone()));
    }

    async fn run_task(&self, task: &Task) -> Result {
        let result = task.run(self.store.clone()).await;

        let count = self.pending.fetch_sub(1, Ordering::AcqRel) - 1;
        if count == 0 {
            self.notify.notify_waiters();
        }

        result
    }

    async fn task_loop(self, parent_span: Option<Id>) {
        while let Ok((task, context_data)) = self.receiver.recv().await {
            let linked_context =
                global::get_text_map_propagator(|propagator| propagator.extract(&context_data));
            let linked_span = linked_context.span().span_context().clone();

            let task_name: &'static str = (&task).into();
            let span = span!(parent: parent_span.clone(), Level::TRACE, "task", "otel.name" = task_name, "otel.status_code" = DEFAULT_STATUS, "otel.status_description" = field::Empty);
            span.add_link(linked_span);

            let result = self.run_task(&task).instrument(span.clone()).await;
            record_result(&span, &result);
        }
    }
}

impl TaskQueue {
    pub(crate) fn new() -> Self {
        let (sender, receiver) = unbounded();

        Self {
            notify: Arc::new(Notify::new()),
            pending: Arc::new(AtomicUsize::new(0)),
            sender,
            receiver,
        }
    }

    pub(crate) fn spawn(&self, store: &Store, parent_span: Option<Id>) {
        let workers = 3;

        for _ in 0..workers {
            TaskLoop::spawn(self, store, parent_span.clone());
        }

        tokio::spawn(TaskQueue::cron_loop(store.clone()));
    }

    pub(crate) async fn finish_tasks(&self) {
        let count = self.pending.load(Ordering::Acquire);
        if count > 0 {
            self.notify.notified().await;
        }
    }

    pub(crate) async fn queue_task(&self, task: Task) {
        self.pending.fetch_add(1, Ordering::AcqRel);

        let mut context_data = HashMap::new();
        let context = Span::current().context();
        global::get_text_map_propagator(|propagator| {
            propagator.inject_context(&context, &mut context_data)
        });

        self.sender.send((task, context_data)).await.unwrap();
    }

    async fn cron_inner(store: &Store) -> Result {
        let now = Local::now();
        let hours = if now.minute() >= 30 {
            now.hour() + 1
        } else {
            now.hour()
        };

        let mut db_conn = store.connect().await?;
        let catalogs: Vec<String> = models::Catalog::list(&mut db_conn)
            .await?
            .into_iter()
            .map(|c| c.id)
            .collect();

        // Hourly
        for catalog in catalogs.iter() {
            store
                .queue_task(Task::UpdateSearches {
                    catalog: catalog.clone(),
                })
                .await;
        }

        // Daily
        {
            let catalogs = partition(&catalogs, 24, hours);
            for catalog in catalogs.iter() {
                store
                    .queue_task(Task::ProcessMedia {
                        catalog: catalog.to_string(),
                    })
                    .await;
                store
                    .queue_task(Task::DeleteMedia {
                        catalog: catalog.to_string(),
                    })
                    .await;
                store
                    .queue_task(Task::PruneMediaItems {
                        catalog: catalog.to_string(),
                    })
                    .await;
                store
                    .queue_task(Task::PruneMediaFiles {
                        catalog: catalog.to_string(),
                    })
                    .await;
            }
        }

        if hours == 2 {
            // Monthly
            let month = now.month();
            let year = now.year();
            let days_in_month = if month == 12 {
                NaiveDate::from_ymd_opt(year + 1, 1, 1)
            } else {
                NaiveDate::from_ymd_opt(year, month + 1, 1)
            }
            .unwrap()
            .signed_duration_since(NaiveDate::from_ymd_opt(year, month, 1).unwrap())
            .num_days() as u32;

            let catalogs = partition(&catalogs, days_in_month, now.day0());
            for catalog in catalogs.iter() {
                store
                    .queue_task(Task::VerifyStorage {
                        catalog: catalog.to_string(),
                        delete_files: true,
                    })
                    .await;
            }
        }

        Ok(())
    }

    async fn cron_loop(store: Store) {
        loop {
            sleep(next_tick()).await;
            Self::cron_inner(&store).await.warn();
        }
    }
}
