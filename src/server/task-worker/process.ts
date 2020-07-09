import { ExifDateTime, ExifDate, ExifTime } from "exiftool-vendored";

import { Logger } from "../../utils";
import { getMedia } from "../database/unsafe";
import { FileInfo } from "../storage";
import { StoredTags, parseMetadata } from "./metadata";
import Services from "./services";
import { bindTask } from "./task";

async function parseTags(file: FileInfo): Promise<StoredTags> {
  let exiftool = await Services.exiftool;
  let tags = await exiftool.read(file.path);

  return {
    ...Object.fromEntries(
      Object.entries(tags).map(([key, value]: [string, unknown]): [string, unknown] => {
        if (
          value instanceof ExifDate ||
          value instanceof ExifDateTime ||
          value instanceof ExifTime
        ) {
          return [key, value.toISOString()];
        }
        return [key, value];
      }),
    ),
    FileName: file.name,
  };
}

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

      let tags = await parseTags(file);
      let metadata = parseMetadata(tags);
      console.log(metadata);

      await storage.get().deleteUploadedFile(mediaId);
    } finally {
      storage.release();
    }
  },
);
