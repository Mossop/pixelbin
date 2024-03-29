use std::{collections::HashMap, time::Instant};

use async_channel::{unbounded, Receiver, Sender};
use futures::StreamExt;
use scoped_futures::ScopedFutureExt;
use tracing::{error, instrument, trace, Span};

use crate::{
    metadata::reprocess_media_file,
    store::{db::DbConnection, models, path::ResourcePath},
    FileStore, Result, Store,
};

const TASK_STARTUP: &str = "startup";
const TASK_PROCESS_MEDIA_FILE: &str = "process_media_file";
const TASK_DELETE_MEDIA: &str = "delete_media";
const TASK_UPDATE_SEARCHES: &str = "update_searches";

pub(super) enum Task {
    Startup,
    ProcessMediaFile { media_file: String },
    DeleteMedia { media: Vec<String> },
    UpdateSearches { catalog: String },
}

async fn process_media_file(conn: &mut DbConnection<'_>, media_file: &str) -> Result {
    let (mut media_file, media_file_path) = models::MediaFile::get(conn, media_file).await?;
    let storage = models::Storage::get_for_catalog(conn, &media_file_path.catalog).await?;

    let remote_store = storage.file_store().await?;

    reprocess_media_file(conn, &mut media_file, &media_file_path, &remote_store, true).await?;

    models::MediaFile::upsert(conn, vec![media_file]).await?;

    models::MediaItem::update_media_files(conn, &media_file_path.catalog).await?;

    models::SavedSearch::update_for_catalog(conn, &media_file_path.catalog).await?;

    let files = models::MediaFile::list_prunable(conn, &media_file_path.catalog).await?;
    for (file, path) in files {
        file.delete(conn, &storage, &path).await?;
    }

    Ok(())
}

async fn delete_media_items(conn: &mut DbConnection<'_>, media: Vec<models::MediaItem>) -> Result {
    let media_ids = media.iter().map(|m| m.id.clone()).collect::<Vec<String>>();

    models::MediaItem::delete(conn, &media_ids).await?;

    let mut mapped: HashMap<String, Vec<models::MediaItem>> = HashMap::new();
    for m in media {
        mapped.entry(m.catalog.clone()).or_default().push(m);
    }

    let local_store = conn.config().local_store();
    let temp_store = conn.config().local_store();

    for (catalog, media) in mapped.iter() {
        let storage = models::Storage::get_for_catalog(conn, catalog).await?;
        let remote_store = storage.file_store().await?;

        for media in media {
            let path = ResourcePath::MediaItem(media.path());

            remote_store.delete(&path).await?;
            local_store.delete(&path).await?;
            temp_store.delete(&path).await?;
        }
    }

    for catalog in mapped.keys() {
        models::SavedSearch::update_for_catalog(conn, catalog).await?;
    }

    Ok(())
}

async fn delete_media_ids(conn: &mut DbConnection<'_>, ids: Vec<String>) -> Result {
    let media = models::MediaItem::get(conn, &ids).await?;
    delete_media_items(conn, media).await
}

async fn startup_tasks(conn: &mut DbConnection<'_>) -> Result {
    let media = models::MediaItem::list_deleted(conn).await?;
    delete_media_items(conn, media).await
}

impl Task {
    fn name(&self) -> &'static str {
        match self {
            Task::Startup => TASK_STARTUP,
            Task::ProcessMediaFile { media_file: _ } => TASK_PROCESS_MEDIA_FILE,
            Task::DeleteMedia { media: _ } => TASK_DELETE_MEDIA,
            Task::UpdateSearches { catalog: _ } => TASK_UPDATE_SEARCHES,
        }
    }

    async fn run(self, conn: &mut DbConnection<'_>) -> Result {
        match self {
            Task::Startup => startup_tasks(conn).await,
            Task::ProcessMediaFile { media_file } => process_media_file(conn, &media_file).await,
            Task::DeleteMedia { media } => delete_media_ids(conn, media).await,
            Task::UpdateSearches { catalog } => {
                models::SavedSearch::update_for_catalog(conn, &catalog).await
            }
        }
    }
}

#[derive(Clone)]
pub(super) struct TaskQueue {
    sender: Sender<Task>,
}

impl TaskQueue {
    pub(super) fn new(store: &Store, workers: usize) -> Self {
        let (sender, receiver) = unbounded();

        for _ in 0..(workers - 1) {
            tokio::spawn(TaskQueue::task_loop(store.clone(), receiver.clone()));
        }
        tokio::spawn(TaskQueue::task_loop(store.clone(), receiver));

        Self { sender }
    }

    pub(super) async fn queue_task(&self, task: Task) {
        self.sender.send(task).await.unwrap();
    }

    #[instrument(skip_all, fields(otel.name, otel.status_code, duration))]
    async fn run_task(store: &Store, task: Task) {
        let start = Instant::now();
        Span::current().record("otel.name", task.name());

        let result = store
            .in_transaction(|conn| async move { task.run(conn).await }.scope_boxed())
            .await;

        let duration = Instant::now().duration_since(start).as_millis();
        Span::current().record("duration", duration);

        match result {
            Ok(()) => {
                Span::current().record("otel.status_code", "Ok");
                trace!("Task complete");
            }
            Err(e) => {
                Span::current().record("otel.status_code", "Error");
                error!(error = %e, "Task failed");
            }
        }
    }

    async fn task_loop(store: Store, receiver: Receiver<Task>) {
        let mut receiver = Box::pin(receiver);

        while let Some(task) = receiver.next().await {
            TaskQueue::run_task(&store, task).await;
        }
    }
}
