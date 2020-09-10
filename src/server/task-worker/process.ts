import { promises as fs } from "fs";
import path from "path";

import { extension as mimeExtension } from "mime-types";
import sharp from "sharp";
import { dir as tmpdir } from "tmp-promise";

import { AlternateFileType } from "../../model";
import { Logger } from "../../utils";
import { DatabaseConnection } from "../database";
import { OriginalInfo } from "../database/unsafe";
import { extractFrame, encodeVideo, VideoCodec, AudioCodec, Container } from "./ffmpeg";
import { parseFile, parseMetadata, getOriginal } from "./metadata";
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

export const MEDIA_THUMBNAIL_SIZES = [
  150,
  200,
  300,
  400,
  500,
];

export const handleUploadedFile = bindTask(
  async function handleUploadedFile(logger: Logger, mediaId: string): Promise<void> {
    logger = logger.child({
      media: mediaId,
    });

    let dbConnection = await Services.database;

    let media = await dbConnection.getMedia(mediaId);
    if (!media) {
      logger.warn("Media does not exist.");
      return;
    }

    let storageService = await Services.storage;

    let dir = await tmpdir({
      unsafeCleanup: true,
    });
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
      let info = getOriginal(data);

      let fileName = metadata.filename ?? `original.${mimeExtension(data.mimetype)}`;
      let baseName = fileName.substr(0, fileName.length - path.extname(fileName).length);

      let original = await dbConnection.withNewOriginal(mediaId, {
        ...metadata,
        ...info,
        processVersion: PROCESS_VERSION,
        fileName,
      }, async (
        dbConnection: DatabaseConnection,
        original: OriginalInfo,
      ): Promise<OriginalInfo> => {
        try {
          let source = fileInfo.path;
          if (info.mimetype.startsWith("video/")) {
            logger.trace("Generating video poster frame.");
            source = path.join(dir.path, `${baseName}-poster.jpg`);
            await extractFrame(fileInfo.path, source);

            await storage.get().storeFile(mediaId, original.id, path.basename(source), source);

            let stat = await fs.stat(source);
            let metadata = await sharp(source).metadata();
            await dbConnection.addAlternateFile(original.id, {
              type: AlternateFileType.Poster,
              fileName: path.basename(source),
              fileSize: stat.size,
              width: metadata.width ?? 0,
              height: metadata.height ?? 0,
              mimetype: "image/jpeg",
              duration: null,
              frameRate: null,
              bitRate: null,
            });
          }

          logger.trace("Building thumbnails.");
          for (let size of MEDIA_THUMBNAIL_SIZES) {
            let fileName = `${baseName}-${size}.jpg`;
            let target = await storage.get().getLocalFilePath(
              mediaId,
              original.id,
              fileName,
            );
            let info = await sharp(source)
              .resize(size, size, {
                fit: "inside",
              })
              .jpeg({
                quality: 90,
              })
              .toFile(target);

            await dbConnection.addAlternateFile(original.id, {
              type: AlternateFileType.Thumbnail,
              fileName,
              fileSize: info.size,
              width: info.width,
              height: info.height,
              mimetype: `image/${info.format}`,
              duration: null,
              frameRate: null,
              bitRate: null,
            });
          }

          await storage.get().storeFile(mediaId, original.id, fileName, fileInfo.path);

          return original;
        } catch (e) {
          await storage.get().deleteLocalFiles(mediaId, original.id);
          throw e;
        }
      });

      if (info.mimetype.startsWith("video/")) {
        let dir = await tmpdir({
          unsafeCleanup: true,
        });

        try {
          let videoCodec = VideoCodec.H264;
          let audioCodec = AudioCodec.AAC;
          let container = Container.MP4;

          let fileName = `${baseName}-${videoCodec}.${container}`;
          logger.trace(`Re-encoding video using ${videoCodec} codec.`);
          let target = path.join(dir.path, fileName);
          let videoInfo = await encodeVideo(
            fileInfo.path,
            videoCodec,
            audioCodec,
            container,
            target,
          );

          await storage.get().storeFile(mediaId, original.id, fileName, target);

          await dbConnection.addAlternateFile(original.id, {
            type: AlternateFileType.Reencode,
            fileName,
            fileSize: videoInfo.format.size,
            width: videoInfo.videoStream?.width ?? 0,
            height: videoInfo.videoStream?.height ?? 0,
            mimetype: `video/${videoInfo.format.container}`,
            duration: videoInfo.format.duration,
            bitRate: videoInfo.format.bitRate,
            frameRate: videoInfo.videoStream?.frameRate ?? null,
          });
        } finally {
          await dir.cleanup();
        }
      }

      await storage.get().deleteUploadedFile(mediaId);
    } finally {
      storage.release();
      await dir.cleanup();
    }
  },
);
