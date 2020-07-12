import path from "path";

import execa, { ExecaError } from "execa";
import sharp from "sharp";
import { dir as tmpdir } from "tmp-promise";

import { MEDIA_THUMBNAIL_SIZES } from "../../model/models";
import { Logger, RefCounted } from "../../utils";
import { getMedia, createMediaInfo } from "../database/unsafe";
import { FileInfo } from "../storage";
import { parseFile, parseMetadata, getMediaInfo } from "./metadata";
import Services from "./services";
import { bindTask } from "./task";

const PROCESS_VERSION = 1;

async function getThumbSource(
  logger: Logger,
  file: FileInfo,
  mimetype: string,
): Promise<RefCounted<string>> {
  if (mimetype.startsWith("image/")) {
    return new RefCounted(file.path);
  }

  let dir = await tmpdir({
    unsafeCleanup: true,
  });
  let source = path.join(dir.path, "temp.jpg");

  try {
    logger.trace("Generating video poster frame.");
    /* eslint-disable array-element-newline */
    await execa("ffmpeg", [
      "-y",
      "-loglevel", "warning",
      "-i", file.path,
      "-frames:v", "1",
      "-q:v", "3",
      "-f", "singlejpeg",
      "-y",
      source,
    ], {
      all: true,
    });
    /* eslint-enable array-element-newline */
  } catch (e) {
    let error: ExecaError = e;
    logger.error({
      output: error.all,
    }, "Failed to extract video frame.");
    throw e;
  }

  return new RefCounted(source, (): void => {
    logger.catch(dir.cleanup());
  });
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

      logger.trace("Parsing file metadata.");

      let data = await parseFile(file);
      let metadata = parseMetadata(data);
      let info = getMediaInfo(data);

      /**
       * TODO: There is a race condition here, the webserver will see the mediainfo complete
       * before the thumbnails are written and file uploaded...
       */

      let mediaInfo = await createMediaInfo(mediaId, {
        ...metadata,
        ...info,
        processVersion: PROCESS_VERSION,
      });

      let source = await getThumbSource(logger, file, info.mimetype);
      try {
        logger.trace("Building thumbnails.");
        for (let size of MEDIA_THUMBNAIL_SIZES) {
          let target = await storage.get().getLocalFilePath(
            mediaId,
            mediaInfo.id,
            `thumb${size}.jpg`,
          );
          await sharp(source.get())
            .resize(size, size, {
              fit: "inside",
            })
            .jpeg({
              quality: 90,
            })
            .toFile(target);
        }
      } finally {
        source.release();
      }

      await storage.get().deleteUploadedFile(mediaId);
    } finally {
      storage.release();
    }
  },
);
