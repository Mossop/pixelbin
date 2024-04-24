use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};

use async_channel::{unbounded, Receiver, Sender};
use chrono::{Local, Timelike};
use opentelemetry::{global, trace::TraceContextExt};
use strum_macros::IntoStaticStr;
use tokio::{sync::Notify, time::sleep};
use tracing::{error, field, span, span::Id, Instrument, Level, Span};
use tracing_opentelemetry::OpenTelemetrySpanExt;

use crate::{
    store::db::{DbConnection, DbPool},
    task_queue::{
        maintenance::{
            prune_media_files, prune_media_items, server_startup, trigger_media_tasks,
            update_searches, verify_storage,
        },
        media::{build_alternates, delete_media, extract_metadata, upload_media_file},
    },
    Config, Result,
};

mod maintenance;
mod media;

#[derive(Debug, IntoStaticStr)]
pub enum Task {
    ServerStartup,
    DeleteMedia { media: Vec<String> },
    UpdateSearches { catalog: String },
    VerifyStorage { catalog: String, delete_files: bool },
    PruneMediaFiles { catalog: String },
    PruneMediaItems { catalog: String },
    ProcessMedia { catalog: String },
    ExtractMetadata { media_file: String },
    UploadMediaFile { media_file: String },
    BuildAlternates { media_file: String, typ: String },
}

impl Task {
    async fn run(&self, conn: &mut DbConnection<'_>) -> Result {
        match self {
            Task::ServerStartup => server_startup(conn).await,
            Task::DeleteMedia { media } => delete_media(conn, media).await,
            Task::UpdateSearches { catalog } => update_searches(conn, catalog).await,
            Task::VerifyStorage {
                catalog,
                delete_files,
            } => verify_storage(conn, catalog, *delete_files).await,
            Task::PruneMediaFiles { catalog } => prune_media_files(conn, catalog).await,
            Task::PruneMediaItems { catalog } => prune_media_items(conn, catalog).await,
            Task::ProcessMedia { catalog } => trigger_media_tasks(conn, catalog).await,
            Task::ExtractMetadata { media_file } => extract_metadata(conn, media_file).await,
            Task::UploadMediaFile { media_file } => upload_media_file(conn, media_file).await,
            Task::BuildAlternates { media_file, typ } => {
                build_alternates(conn, media_file, typ).await
            }
        }
    }

    fn is_expensive(&self) -> bool {
        match self {
            Task::BuildAlternates { typ, .. } => typ.as_str() == mime::VIDEO,
            _ => false,
        }
    }
}

fn next_tick() -> Duration {
    let now = Local::now();
    let seconds = 60 - now.second();

    Duration::from_secs(seconds as u64)
}

type TaskMessage = (Task, HashMap<String, String>);

#[derive(Clone)]
pub(crate) struct TaskQueue {
    pool: DbPool,
    config: Config,
    notify: Arc<Notify>,
    pending: Arc<AtomicUsize>,
    sender: Sender<TaskMessage>,
    expensive_sender: Sender<TaskMessage>,
}

impl TaskQueue {
    pub(crate) fn new(pool: DbPool, config: Config, parent_span: Option<Id>) -> Self {
        let (sender, receiver) = unbounded();
        let (expensive_sender, expensive_receiver) = unbounded();

        let queue = Self {
            pool,
            config: config.clone(),
            notify: Arc::new(Notify::new()),
            pending: Arc::new(AtomicUsize::new(0)),
            sender,
            expensive_sender,
        };

        let expensive_workers = 1;
        let workers = 3;

        for _ in 0..workers {
            tokio::spawn(TaskQueue::task_loop(
                queue.clone(),
                receiver.clone(),
                parent_span.clone(),
            ));
        }

        for _ in 0..expensive_workers {
            tokio::spawn(TaskQueue::task_loop(
                queue.clone(),
                expensive_receiver.clone(),
                parent_span.clone(),
            ));
        }

        tokio::spawn(TaskQueue::cron_loop(queue.clone()));

        queue
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

        if task.is_expensive() {
            self.expensive_sender
                .send((task, context_data))
                .await
                .unwrap();
        } else {
            self.sender.send((task, context_data)).await.unwrap();
        }
    }

    async fn run_task(&self, task: &Task) -> Result {
        let mut conn = self.pool.get().await?;
        let mut db_conn = DbConnection::new(&mut conn, &self.config, self);
        let result = task.run(&mut db_conn).await;

        let count = self.pending.fetch_sub(1, Ordering::AcqRel) - 1;
        if count == 0 {
            self.notify.notify_waiters();
        }

        result
    }

    async fn cron_loop(self) {
        loop {
            sleep(next_tick()).await;

            let now = Local::now();
            let _hours = now.hour();
            let _minutes = now.minute();
        }
    }

    async fn task_loop(queue: TaskQueue, receiver: Receiver<TaskMessage>, parent_span: Option<Id>) {
        while let Ok((task, context_data)) = receiver.recv().await {
            let linked_context =
                global::get_text_map_propagator(|propagator| propagator.extract(&context_data));
            let linked_span = linked_context.span().span_context().clone();

            let task_name: &'static str = (&task).into();
            let span = span!(parent: parent_span.clone(), Level::INFO, "task", "otel.name" = task_name, "otel.status_code" = field::Empty);
            span.add_link(linked_span);

            match queue.run_task(&task).instrument(span.clone()).await {
                Ok(()) => {
                    span.record("otel.status_code", "Ok");
                }
                Err(e) => {
                    error!(error = %e, task = ?task, "Task failed");
                    span.record("otel.status_code", "Error");
                }
            }
        }
    }
}
