//! The task queue is used for running any potentially long-running or periodic tasks. It consists
//! of a queue of pending tasks, a series of task loops that process tasks from the queue, and a
//! cron-like scheduler that periodically adds tasks to the queue.
use std::{
    collections::HashMap,
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
    time::Duration,
};

use chrono::{Datelike, Local, NaiveDate, Timelike};
use opentelemetry::{global, trace::TraceContextExt};
use pixelbin_shared::Ignorable;
use strum_macros::IntoStaticStr;
use tokio::{
    runtime::Builder,
    sync::{
        Notify, OwnedSemaphorePermit, Semaphore,
        mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel},
    },
    time::sleep,
};
use tracing::{Instrument, Level, Span, field, span};
use tracing_opentelemetry::OpenTelemetrySpanExt;

mod maintenance;
mod media;
pub(crate) mod opcache;

use crate::{
    Result, Store, StoreType,
    shared::{DEFAULT_STATUS, record_result},
    store::models,
    task_queue::{
        maintenance::{
            clean_queues, delete_alternate_files, process_subscriptions, prune_media_files,
            prune_media_items, server_startup, trigger_media_tasks, update_searches,
            verify_storage,
        },
        media::{process_media_file, prune_deleted_media, upload_media_file},
    },
};

#[cfg(not(debug_assertions))]
const STACK_SIZE: usize = 2 * 1024 * 1024;
#[cfg(debug_assertions)]
const STACK_SIZE: usize = 20 * 1024 * 1024;

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
    /// Uploads the media file.
    UploadMediaFile { media_file: String },
    /// Deletes the no longer required alternate files.
    DeleteAlternateFiles { alternate_files: Vec<String> },
    /// Deletes old requests.
    CleanQueues,
    /// Sends out email subscriptions.
    ProcessSubscriptions { catalog: String },
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
            Task::UploadMediaFile { media_file } => upload_media_file(store, media_file).await,
            Task::DeleteAlternateFiles { alternate_files } => {
                delete_alternate_files(store, alternate_files).await
            }
            Task::CleanQueues => clean_queues(store).await,
            Task::ProcessSubscriptions { catalog } => process_subscriptions(store, catalog).await,
        }
    }
}

/// The duration until the start of the next hour. This is imperfect in the case
/// of timezone changes.
fn next_tick() -> Duration {
    let now = Local::now();
    let seconds = 60 - now.second();
    let minutes = 60 - now.minute();

    Duration::from_secs(((minutes * 60) + seconds) as u64)
}

type TaskMessage = (Task, HashMap<String, String>);

/// Splits a set of strings into a number of partitions based on the last
/// character of each string returning the partition at the given offset.
/// The last character of the string is expected to be alphanumeric (A-Z, a-z, 0-9).
fn partition(set: &[String], partitions: u32, offset: u32) -> Vec<&str> {
    set.iter()
        .filter_map(|s| {
            if s.is_empty() {
                return None;
            }

            let bytes = s.as_bytes();
            let char = bytes[bytes.len() - 1];

            // Map the last character to a value in 0..62
            let value = match char {
                // A .. Z
                65..=90 => char - 65,
                // a .. z
                97..=122 => (char - 97) + 26,
                // 0 .. 9
                48..=57 => (char - 48) + 26 + 26,
                _ => return None,
            } as u32;

            let position = (partitions * value) as f64 / 62.0;
            let offset = offset as f64;

            if position >= offset && position < offset + 1.0 {
                Some(s.as_str())
            } else {
                None
            }
        })
        .collect()
}

#[derive(Clone)]
pub(crate) struct TaskContext {
    store: Store,
    /// Notified whenever there are no tasks remaining in the queue.
    notify: Arc<Notify>,
    pending_tasks: Arc<AtomicUsize>,
}

impl TaskContext {
    fn new(queue: &TaskQueue) -> Self {
        TaskContext {
            store: queue.store.clone(),
            notify: queue.notify.clone(),
            pending_tasks: queue.pending_tasks.clone(),
        }
    }

    async fn run_task(self, span: Span, task: Task, guard: OwnedSemaphorePermit) {
        let result = task.run(self.store).instrument(span.clone()).await;
        record_result(&span, &result);

        let count = self.pending_tasks.fetch_sub(1, Ordering::AcqRel) - 1;
        if count == 0 {
            self.notify.notify_waiters();
        }

        std::mem::drop(guard);
    }

    async fn process_tasks(
        self,
        task_guard: Arc<Semaphore>,
        mut receiver: UnboundedReceiver<TaskMessage>,
    ) {
        while let Some((task, context_data)) = receiver.recv().await {
            let guard = task_guard.clone().acquire_owned().await.unwrap();

            let linked_context =
                global::get_text_map_propagator(|propagator| propagator.extract(&context_data));
            let linked_span = linked_context.span().span_context().clone();

            let task_name: &'static str = (&task).into();
            let span = span!(
                Level::TRACE,
                "task",
                "otel.name" = task_name,
                "otel.status_code" = DEFAULT_STATUS,
                "otel.status_description" = field::Empty
            );
            span.add_link(linked_span);

            let task_context = self.clone();
            tokio::spawn(task_context.run_task(span, task, guard));
        }
    }
}

pub(crate) struct TaskQueue {
    store: Store,
    /// Notified whenever there are no tasks remaining in the queue.
    notify: Arc<Notify>,
    pending_tasks: Arc<AtomicUsize>,
    sender: UnboundedSender<TaskMessage>,
}

impl TaskQueue {
    pub(crate) fn new(store: &Store) -> Self {
        let (sender, receiver) = unbounded_channel();

        let queue = Self {
            store: store.clone(),
            notify: Arc::new(Notify::new()),
            pending_tasks: Arc::new(AtomicUsize::new(0)),
            sender,
        };

        let concurrency = if store.store_type() == StoreType::Server {
            4
        } else {
            1
        };

        let task_context = TaskContext::new(&queue);
        let task_guard = Arc::new(Semaphore::new(concurrency));

        let runtime = Builder::new_multi_thread()
            .thread_stack_size(STACK_SIZE)
            .enable_all()
            .thread_name("task-queue")
            .build()
            .unwrap();

        runtime.spawn(task_context.process_tasks(task_guard, receiver));

        queue
    }

    /// Waits until all pending tasks have completed. This will spawn a new task
    /// loop if none are currently running and there are tasks pending.
    pub(crate) async fn finish_tasks(&self) {
        let count = self.pending_tasks.load(Ordering::Acquire);
        if count > 0 {
            self.notify.notified().await;
        }
    }

    pub(crate) async fn queue_task(&self, task: Task) {
        self.pending_tasks.fetch_add(1, Ordering::AcqRel);

        let mut context_data = HashMap::new();
        let context = Span::current().context();
        global::get_text_map_propagator(|propagator| {
            propagator.inject_context(&context, &mut context_data)
        });

        self.sender.send((task, context_data)).unwrap();
    }
}

pub(crate) fn spawn_cron(store: Store) {
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
        store.queue_task(Task::CleanQueues).await;

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
                store
                    .queue_task(Task::ProcessSubscriptions {
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

    tokio::spawn(async move {
        loop {
            // Wait until the start of the next hour.
            sleep(next_tick()).await;
            cron_inner(&store).await.warn();
        }
    });
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::task_queue::partition;

    fn scan_partition(catalogs: &[String], size: u32) {
        let mut seen_catalogs: HashSet<String> = HashSet::new();

        for offset in 0..size {
            for seen in partition(catalogs, size, offset) {
                assert!(!seen_catalogs.contains(seen), "Should see {seen} only once");

                seen_catalogs.insert(seen.to_owned());
            }
        }

        assert_eq!(
            seen_catalogs.len(),
            catalogs.len(),
            "Should see all catalogs once"
        );
    }

    #[test]
    fn test_partition() {
        let mut catalogs: Vec<String> = Vec::new();
        for i in 0_u8..26 {
            catalogs.push(std::str::from_utf8(&[i + 65]).unwrap().to_owned());
            catalogs.push(std::str::from_utf8(&[i + 97]).unwrap().to_owned());
        }

        for i in 0_u8..10 {
            catalogs.push(std::str::from_utf8(&[i + 48]).unwrap().to_owned());
        }

        scan_partition(&catalogs, 28);
        scan_partition(&catalogs, 30);
        scan_partition(&catalogs, 31);
    }
}
