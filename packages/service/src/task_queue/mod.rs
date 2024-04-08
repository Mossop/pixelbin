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
use mime::Mime;
use tokio::{sync::Notify, time::sleep};
use tracing::{error, field, span, span::Id, Instrument, Level, Span};

use crate::{
    store::{
        db::{DbConnection, DbPool},
        models,
        path::ResourcePath,
    },
    task_queue::{
        maintenance::{prune_media_files, trigger_media_tasks, update_searches, verify_storage},
        media::{build_alternate, delete_media_file, extract_metadata, upload_media_file},
    },
    Config, FileStore, Result,
};

mod maintenance;
mod media;

#[derive(Debug)]
pub enum Task {
    ServerStartup,
    DeleteMedia { media: Vec<String> },
    UpdateSearches { catalog: String },
    VerifyStorage { catalog: String },
    PruneMediaFiles { catalog: String },
    ProcessMedia { catalog: String },
    ExtractMetadata { media_file: String },
    UploadMediaFile { media_file: String },
    DeleteMediaFile { media_file: String },
    BuildAlternate { alternate: String, mimetype: Mime },
}

// async fn process_media_file(conn: &mut DbConnection<'_>, media_file: &str) -> Result {
//     let (mut media_file, media_file_path) = models::MediaFile::get(conn, media_file).await?;
//     let storage = models::Storage::get_for_catalog(conn, &media_file_path.catalog).await?;

//     let remote_store = storage.file_store().await?;

//     reprocess_media_file(conn, &mut media_file, &media_file_path, &remote_store, true).await?;

//     models::MediaFile::upsert(conn, vec![media_file]).await?;

//     models::MediaItem::update_media_files(conn, &media_file_path.catalog).await?;

//     models::SavedSearch::update_for_catalog(conn, &media_file_path.catalog).await?;

//     let files = models::MediaFile::list_prunable(conn, &media_file_path.catalog).await?;
//     for (file, path) in files {
//         file.delete(conn, &storage, &path).await?;
//     }

//     Ok(())
// }

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

async fn delete_media_ids(conn: &mut DbConnection<'_>, ids: &[String]) -> Result {
    let media = models::MediaItem::get(conn, ids).await?;
    delete_media_items(conn, media).await
}

async fn server_startup_tasks(conn: &mut DbConnection<'_>) -> Result {
    let media = models::MediaItem::list_deleted(conn).await?;
    delete_media_items(conn, media).await
}

impl Task {
    async fn run(&self, conn: &mut DbConnection<'_>) -> Result {
        match self {
            Task::ServerStartup => server_startup_tasks(conn).await,
            Task::DeleteMedia { media } => delete_media_ids(conn, media).await,
            Task::UpdateSearches { catalog } => update_searches(conn, catalog).await,
            Task::VerifyStorage { catalog } => verify_storage(conn, catalog).await,
            Task::PruneMediaFiles { catalog } => prune_media_files(conn, catalog).await,
            Task::ProcessMedia { catalog } => trigger_media_tasks(conn, catalog).await,
            Task::ExtractMetadata { media_file } => extract_metadata(conn, media_file).await,
            Task::UploadMediaFile { media_file } => upload_media_file(conn, media_file).await,
            Task::DeleteMediaFile { media_file } => delete_media_file(conn, media_file).await,
            Task::BuildAlternate {
                alternate,
                mimetype: _,
            } => build_alternate(conn, alternate).await,
        }
    }

    fn is_expensive(&self) -> bool {
        match self {
            Task::ServerStartup => false,
            Task::DeleteMedia { media: _ } => false,
            Task::UpdateSearches { catalog: _ } => false,
            Task::VerifyStorage { catalog: _ } => false,
            Task::PruneMediaFiles { catalog: _ } => false,
            Task::ProcessMedia { catalog: _ } => false,
            Task::ExtractMetadata { media_file: _ } => false,
            Task::UploadMediaFile { media_file: _ } => false,
            Task::DeleteMediaFile { media_file: _ } => false,
            Task::BuildAlternate {
                alternate: _,
                mimetype,
            } => mimetype.type_() == mime::VIDEO,
        }
    }
}

fn next_tick() -> Duration {
    let now = Local::now();
    let seconds = 60 - now.second();

    Duration::from_secs(seconds as u64)
}

#[derive(Clone)]
pub(crate) struct TaskQueue {
    pool: DbPool,
    config: Config,
    notify: Arc<Notify>,
    pending: Arc<AtomicUsize>,
    sender: Sender<(Task, Option<Id>)>,
    expensive_sender: Sender<(Task, Option<Id>)>,
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

        self.sender.close();
    }

    pub(crate) async fn queue_task(&self, task: Task) {
        self.pending.fetch_add(1, Ordering::AcqRel);
        let follows_from = Span::current().id();

        if task.is_expensive() {
            self.expensive_sender
                .send((task, follows_from))
                .await
                .unwrap();
        } else {
            self.sender.send((task, follows_from)).await.unwrap();
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

    async fn task_loop(
        queue: TaskQueue,
        receiver: Receiver<(Task, Option<Id>)>,
        parent_span: Option<Id>,
    ) {
        while let Ok((task, follows_from)) = receiver.recv().await {
            let span = span!(parent: parent_span.clone(), Level::INFO, "task", "otel.status_code" = field::Empty);
            span.follows_from(follows_from);

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
