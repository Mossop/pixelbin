import { getLogger } from "../../utils";
import { quit } from "./events";
import Services, { initTaskManager, initWebserver, initEmail, initScheduler } from "./services";

const logger = getLogger("pixelbin");

async function reprocessUploads(): Promise<void> {
  let service = await Services.storage;
  let taskManager = await Services.taskManager;
  for await (let file of service.listUploadedFiles()) {
    taskManager.handleUploadedFile(file.media);
  }
}

async function startSchedule(): Promise<void> {
  let scheduler = await Services.scheduler;

  async function purge(): Promise<void> {
    let manager = await Services.taskManager;
    manager.purgeDeletedMedia();
    scheduler.schedule("purge", 5 * 60 * 1000, purge);
  }

  scheduler.schedule("purge", 30000, purge);
}

export default async function serve(): Promise<void> {
  initTaskManager();
  initWebserver();
  initEmail();
  initScheduler();

  process.on("SIGTERM", (): void => {
    logger.trace("Received SIGTERM.");
    quit();
  });

  process.on("SIGINT", (): void => {
    logger.trace("Received SIGINT.");
    quit();
  });

  try {
    await reprocessUploads();
    await startSchedule();
  } catch (e) {
    logger.error(e, "Failed starting initial tasks.");
    quit();
  }
}
