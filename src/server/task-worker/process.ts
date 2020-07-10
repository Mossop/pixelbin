import { Logger } from "../../utils";
import { getMedia } from "../database/unsafe";
import Services from "./services";
import { bindTask } from "./task";

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

      // let tags = await parseFile(file);
      // let metadata = parseMetadata(tags);

      await storage.get().deleteUploadedFile(mediaId);
    } finally {
      storage.release();
    }
  },
);
