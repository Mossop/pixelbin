import { promises as fs } from "fs";
import path from "path";

import { extension as mimeExtension } from "mime-types";
import sharp from "sharp";
import { dir as tmpdir } from "tmp-promise";

import { AlternateFileType } from "../../model";
import type { Logger, RefCounted } from "../../utils";
import type { DatabaseConnection, MediaFile } from "../database";
import type { Storage } from "../storage";
import { extractFrame, encodeVideo, VideoCodec, AudioCodec, Container } from "./ffmpeg";
import { parseFile, parseMetadata, getMediaFile } from "./metadata";
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
  250,
  300,
  350,
  400,
  450,
  500,
];

export const purgeDeletedMedia = bindTask(
  async function purgeDeletedMedia(logger: Logger): Promise<void> {
    let dbConnection = await Services.database;
    let storageService = await Services.storage;
    let cachedStorage: Map<string, RefCounted<Storage>> = new Map();

    try {
      for (let mediaFile of await dbConnection.getUnusedMediaFiles()) {
        logger.trace({
          media: mediaFile.media,
          original: mediaFile.id,
        }, "Purging unused original.");

        let storage = cachedStorage.get(mediaFile.catalog);
        if (!storage) {
          storage = await storageService.getStorage(mediaFile.catalog);
          cachedStorage.set(mediaFile.catalog, storage);
        }

        for (let alternate of await dbConnection.listAlternateFiles(mediaFile.id)) {
          await storage.get().deleteFile(mediaFile.media, mediaFile.id, alternate.fileName);
          await dbConnection.deleteAlternateFiles([alternate.id]);
        }

        await storage.get().deleteFile(mediaFile.media, mediaFile.id, mediaFile.fileName);
        await storage.get().deleteLocalFiles(mediaFile.media, mediaFile.id);
        await dbConnection.deleteMediaFiles([mediaFile.id]);
      }

      for (let media of await dbConnection.listDeletedMedia()) {
        let storage = cachedStorage.get(media.catalog);
        if (!storage) {
          storage = await storageService.getStorage(media.catalog);
          cachedStorage.set(media.catalog, storage);
        }

        logger.trace({
          media: media.id,
        }, "Purging deleted media.");
        await storage.get().deleteLocalFiles(media.id);
        await dbConnection.deleteMedia([media.id]);
      }
    } finally {
      for (let storage of cachedStorage.values()) {
        storage.release();
      }
    }
  },
);

export const handleUploadedFile = bindTask(
  async function handleUploadedFile(logger: Logger, mediaId: string): Promise<void> {
    logger = logger.withBindings({
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
        logger.error(`Unrecognised mimetype: ${data.mimetype}`);
        return;
      }

      let metadata = parseMetadata(data);
      let info = getMediaFile(data);

      let fileName = metadata.filename ?? `original.${mimeExtension(data.mimetype)}`;
      let baseName = fileName.substr(0, fileName.length - path.extname(fileName).length);

      let original = await dbConnection.withNewMediaFile(mediaId, {
        ...metadata,
        ...info,
        processVersion: PROCESS_VERSION,
        fileName,
      }, async (
        dbConnection: DatabaseConnection,
        mediaFile: MediaFile,
      ): Promise<MediaFile> => {
        try {
          let metadataFile = await storage.get().getLocalFilePath(
            mediaId,
            mediaFile.id,
            "metadata.json",
          );
          await fs.writeFile(metadataFile, JSON.stringify(data));

          let source = fileInfo.path;
          if (info.mimetype.startsWith("video/")) {
            logger.trace("Generating video poster frame.");
            source = path.join(dir.path, `${baseName}-poster.jpg`);
            await extractFrame(fileInfo.path, source);

            await storage.get().storeFile(
              mediaId,
              mediaFile.id,
              path.basename(source),
              source,
              "image/jpeg",
            );

            let stat = await fs.stat(source);
            let metadata = await sharp(source).metadata();
            await dbConnection.addAlternateFile(mediaFile.id, {
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
            let target = path.join(dir.path, fileName);
            let info = await sharp(source)
              .resize(size, size, {
                fit: "inside",
              })
              .jpeg({
                quality: 90,
              })
              .toFile(target);

            await dbConnection.addAlternateFile(mediaFile.id, {
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

            await storage.get().storeFile(
              mediaId,
              mediaFile.id,
              fileName,
              target,
              `image/${info.format}`,
            );
          }

          await storage.get().storeFile(
            mediaId,
            mediaFile.id,
            fileName,
            fileInfo.path,
            mediaFile.mimetype,
          );

          return mediaFile;
        } catch (e) {
          await storage.get().deleteLocalFiles(mediaId, mediaFile.id);
          throw e;
        }
      });

      if (info.mimetype.startsWith("video/")) {
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

          await storage.get().storeFile(
            mediaId,
            original.id,
            fileName,
            target,
            `video/${videoInfo.format.container}`,
          );

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
        } catch (e) {
          // Failure to re-encode is doesn't need to block anything.
          logger.error(e, "Failed to re-encode video.");
        }
      }

      await storage.get().deleteUploadedFile(mediaId);
      return;
    } finally {
      storage.release();
      await dir.cleanup();
    }
  },
);
