import { Logger } from "../../utils";
import { getMedia, createMediaInfo } from "../database/unsafe";
import { parseFile, parseMetadata, getMediaInfo } from "./metadata";
import Services from "./services";
import { bindTask } from "./task";

const PROCESS_VERSION = 1;

export const handleUploadedFile = bindTask(
  async function handleUploadedFile(logger: Logger, mediaId: string): Promise<void> {
    logger = logger.child({
      media: mediaId,
    });

    let media = await getMedia(mediaId);
    if (!media) {
      logger.warn("Media does not exist.");
      return;
    }

    let storageService = await Services.storage;

    let storage = await storageService.getStorage(media.catalog);
    try {
      let file = await storage.get().getUploadedFile(mediaId);
      if (!file) {
        logger.warn("No file found for media.");
        return;
      }

      let data = await parseFile(file);
      let metadata = parseMetadata(data);
      let info = getMediaInfo(data);

      await createMediaInfo(mediaId, {
        ...metadata,
        ...info,
        processVersion: PROCESS_VERSION,
      });

      await storage.get().deleteUploadedFile(mediaId);
    } finally {
      storage.release();
    }
  },
);
