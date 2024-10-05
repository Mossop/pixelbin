use std::{collections::VecDeque, env::current_exe, io, process::Stdio, sync::Arc, thread};

use async_channel::{unbounded, Receiver, Sender};
use pixelbin_shared::IgnorableFuture;
use rustix::process::setpriority_process;
use serde::{Deserialize, Serialize};
use serde_json::{from_str, to_string};
use tokio::{
    io::AsyncWriteExt,
    process::{self, Child, ChildStdin},
    sync::Mutex,
};
use tracing::{error, span, trace, warn, Instrument, Level};

use crate::{store::StoreType, Result, Store, Task};

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "command", content = "params", rename_all = "camelCase")]
pub(crate) enum Command {
    ProcessMediaFile { media_file: String },
}

struct WorkerProcess {
    pipe: ChildStdin,
    process: Child,
}

impl WorkerProcess {
    async fn spawn() -> Result<Self> {
        trace!("Spawing worker process");

        let mut process = process::Command::new(current_exe().unwrap())
            .stdin(Stdio::piped())
            .arg("worker")
            .spawn()?;

        Ok(WorkerProcess {
            pipe: process.stdin.take().unwrap(),
            process,
        })
    }

    fn is_alive(&mut self) -> bool {
        match self.process.try_wait() {
            Ok(Some(_)) => {
                // Worker quit already.
                false
            }
            Err(e) => {
                warn!(error=%e, "Failed to get worker state.");
                false
            }
            _ => true,
        }
    }

    async fn send_command(&mut self, command: &Command) -> bool {
        if !self.is_alive() {
            return false;
        }

        let buffer = format!("{}\n", to_string(command).unwrap());

        if let Err(e) = self.pipe.write_all(buffer.as_bytes()).await {
            error!(error=%e, "Failed to send command to worker, did it die?");
            return false;
        }

        true
    }

    async fn kill(mut self) {
        self.process.kill().warn().await;
    }
}

#[derive(Default)]
struct HostInner {
    workers: VecDeque<WorkerProcess>,
}

#[derive(Clone, Default)]
pub(crate) struct WorkerHost {
    inner: Arc<Mutex<HostInner>>,
}

impl WorkerHost {
    pub(crate) async fn shutdown(&self) {
        let mut inner = self.inner.lock().await;
        for worker in inner.workers.drain(..) {
            worker.kill().await;
        }
    }

    pub(crate) async fn send_command(&self, store: &Store, command: Command) {
        if store.store_type() != StoreType::Server {
            Worker::process_command(store, command).await;
            return;
        }

        let mut inner = self.inner.lock().await;

        // We only want to attempt to spawn once.
        let mut has_spawned = false;

        loop {
            let worker = if !has_spawned && inner.workers.len() < store.config().max_workers {
                has_spawned = true;
                match WorkerProcess::spawn().await {
                    Ok(w) => Some(w),
                    Err(e) => {
                        error!(error=%e, "Failed to spawn worker.");
                        continue;
                    }
                }
            } else {
                inner.workers.pop_front()
            };

            if let Some(mut worker) = worker {
                if worker.send_command(&command).await {
                    inner.workers.push_back(worker);
                    return;
                } else {
                    worker.kill().await;
                }
            } else {
                // We couldn't find a usable worker.
                break;
            }
        }

        // If we were unable to get a worker then just run the command here.
        Worker::process_command(store, command).await;
    }
}

#[derive(Clone)]
struct Worker {
    store: Store,
    sender: Sender<Command>,
    receiver: Receiver<Command>,
}

impl Worker {
    fn new(store: Store) -> Self {
        let (sender, receiver) = unbounded();

        let worker = Worker {
            store,
            sender,
            receiver,
        };

        let loop_worker = worker.clone();
        thread::spawn(move || loop_worker.io_loop());

        worker
    }

    async fn process_command(store: &Store, command: Command) {
        trace!(command=?command, "Processing worker command");

        match command {
            Command::ProcessMediaFile { media_file } => {
                store
                    .queue_task(Task::ProcessMediaFile { media_file })
                    .await;
            }
        }
    }

    async fn process_commands(&self) {
        trace!("Worker process running");

        while let Ok(command) = self.receiver.recv().await {
            Self::process_command(&self.store, command)
                .instrument(span!(Level::TRACE, "process worker command"))
                .await;
        }
    }

    fn io_loop(self) {
        let stdin = io::stdin();

        for line in stdin.lines() {
            let line = match line {
                Ok(l) => l,
                Err(e) => {
                    error!(error=%e, "Failed to read command");
                    break;
                }
            };

            let command = match from_str::<Command>(&line) {
                Ok(c) => c,
                Err(e) => {
                    error!(error=%e, line, "Invalid command");
                    continue;
                }
            };

            if let Err(e) = self.sender.send_blocking(command) {
                error!(error=%e, "Error executing command");
                break;
            }
        }

        self.sender.close();
    }
}

pub async fn worker(store: Store) -> Result {
    let store = store.into_type(StoreType::Worker);

    setpriority_process(None, 10).unwrap();

    let worker = Worker::new(store);
    worker.process_commands().await;

    Ok(())
}
