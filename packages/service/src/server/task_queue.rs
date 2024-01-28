use async_channel::{unbounded, Receiver, Sender};
use futures::StreamExt;
use scoped_futures::ScopedFutureExt;
use tracing::{error, instrument, Level};

use crate::{
    metadata::reprocess_media_file,
    store::{db::DbConnection, models},
    Result, Store,
};

pub(super) enum Task {
    ProcessMediaFile { media_file: String },
}

#[instrument(skip(conn), err(level = Level::ERROR))]
async fn process_media_file(conn: &mut DbConnection<'_>, media_file: &str) -> Result {
    let (mut media_file, media_file_path) = models::MediaFile::get(conn, media_file).await?;
    let storage = models::Storage::get_for_catalog(conn, &media_file_path.catalog).await?;

    let remote_store = storage.file_store().await?;

    reprocess_media_file(conn, &mut media_file, &media_file_path, &remote_store, true).await?;

    models::MediaFile::upsert(conn, vec![media_file]).await?;

    models::MediaItem::update_media_files(conn, &media_file_path.catalog).await?;

    Ok(())
}

impl Task {
    async fn run(self, conn: &mut DbConnection<'_>) -> Result {
        match self {
            Task::ProcessMediaFile { media_file } => process_media_file(conn, &media_file).await,
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

    async fn task_loop(store: Store, receiver: Receiver<Task>) {
        let mut receiver = Box::pin(receiver);

        while let Some(task) = receiver.next().await {
            if let Err(e) = store
                .in_transaction(|conn| async move { task.run(conn).await }.scope_boxed())
                .await
            {
                error!(error=?e, "Task threw an error");
            }
        }
    }
}
