import path from "path";

import { extension as mimeExtension } from "mime-types";
import sharp from "sharp";
import { dir as tmpdir } from "tmp-promise";

import { MEDIA_THUMBNAIL_SIZES } from "../../model/models";
import { Logger, RefCounted } from "../../utils";
import { getMedia, withNewMediaInfo, MediaInfoAPIResult } from "../database/unsafe";
import { FileInfo } from "../storage";
import { extractFrame, encodeVideo, VideoCodec, AudioCodec, Container } from "./ffmpeg";
import { parseFile, parseMetadata, getMediaInfo } from "./metadata";
import Services from "./services";
import { bindTask } from "./task";

const PROCESS_VERSION = 1;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "video/mp4",
  "video/x-m4v",
  "video/x-matroska",
  "video/webm",
  "video/quicktime",
  "video/mpeg",
];

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
    await extractFrame(file.path, source);
  } catch (e) {
    logger.error({ output: e }, "Failed to extract video frame.");
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

      let fileInfo = file;

      logger.trace("Parsing file metadata.");

      let data = await parseFile(file);

      if (!ALLOWED_TYPES.includes(data.mimetype)) {
        await storage.get().deleteUploadedFile(mediaId);
        throw new Error(`Unrecognised mimetype: ${data.mimetype}`);
      }

      let metadata = parseMetadata(data);
      let info = getMediaInfo(data);

      let hostedName = metadata.filename ?? `original.${mimeExtension(data.mimetype)}`;

      await withNewMediaInfo(mediaId, {
        ...metadata,
        ...info,
        processVersion: PROCESS_VERSION,
        hostedName,
      }, async ({ id: mediaInfoId }: MediaInfoAPIResult): Promise<void> => {
        try {
          let source = await getThumbSource(logger, fileInfo, info.mimetype);
          try {
            logger.trace("Building thumbnails.");
            for (let size of MEDIA_THUMBNAIL_SIZES) {
              let target = await storage.get().getLocalFilePath(
                mediaId,
                mediaInfoId,
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

          await storage.get().storeFile(mediaId, mediaInfoId, hostedName, fileInfo.path);

          if (info.mimetype.startsWith("video/")) {
            let dir = await tmpdir({
              unsafeCleanup: true,
            });

            try {
              logger.trace("Encoding video using h264 codec.");
              let target = path.join(dir.path, "h264.mp4");
              await encodeVideo(
                fileInfo.path,
                VideoCodec.H264,
                AudioCodec.AAC,
                Container.MP4,
                target,
              );
              await storage.get().storeFile(mediaId, mediaInfoId, "h264.mp4", target);
            } finally {
              await dir.cleanup();
            }
          }

          await storage.get().deleteUploadedFile(mediaId);
        } catch (e) {
          await storage.get().deleteLocalFiles(mediaId, mediaInfoId);
          throw e;
        }
      });
    } finally {
      storage.release();
    }
  },
);
