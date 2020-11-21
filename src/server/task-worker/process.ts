import { promises as fs } from "fs";
import path from "path";

import sharp from "sharp";
import { dir as tmpdir } from "tmp-promise";

import { AlternateFileType } from "../../model";
import { CURRENT_PROCESS_VERSION } from "../../model/models";
import type { Logger, RefCounted } from "../../utils";
import type { DatabaseConnection, MediaFile } from "../database";
import type { Storage, StoredFile } from "../storage";
import { extractFrame, encodeVideo, VideoCodec, AudioCodec, Container } from "./ffmpeg";
import { parseFile, parseMetadata, getMediaFile } from "./metadata";
import Services from "./services";
import { bindTask } from "./task";

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

async function extractMetadata(
  logger: Logger,
  storage: Storage,
  sourceFile: StoredFile,
  mediaId: string,
  mediaFileId: string,
): Promise<void> {
  logger.trace("Parsing file metadata.");

  let data = await parseFile(sourceFile);

  let metadataFile = await storage.getLocalFilePath(
    mediaId,
    mediaFileId,
    "metadata.json",
  );
  await fs.writeFile(metadataFile, JSON.stringify(data));
}

async function parseExtractedMetadata(
  storage: Storage,
  mediaId: string,
  mediaFileId: string,
): Promise<Omit<MediaFile, "id" | "media" | "processVersion">> {
  let metadataFile = await storage.getLocalFilePath(
    mediaId,
    mediaFileId,
    "metadata.json",
  );

  let data = JSON.parse(await fs.readFile(metadataFile, {
    encoding: "utf8",
  }));

  return {
    ...parseMetadata(data),
    ...getMediaFile(data),
  };
}

async function encodeFile(
  logger: Logger,
  dbConnection: DatabaseConnection,
  storage: Storage,
  mediaId: string,
  mediaFile: MediaFile,
  source: string,
): Promise<void> {
  let dir = await tmpdir({
    unsafeCleanup: true,
  });

  try {
    let isVideo = mediaFile.mimetype.startsWith("video/");
    let baseName = mediaFile.fileName.substr(
      0,
      mediaFile.fileName.length - path.extname(mediaFile.fileName).length,
    );

    let thumbnailSource = source;

    if (isVideo) {
      logger.trace("Generating video poster frame.");
      let poster = path.join(dir.path, `${baseName}-poster.jpg`);
      thumbnailSource = poster;
      await extractFrame(source, poster);

      await storage.storeFile(
        mediaId,
        mediaFile.id,
        path.basename(poster),
        poster,
        "image/jpeg",
      );

      let stat = await fs.stat(poster);
      let metadata = await sharp(poster).metadata();
      await dbConnection.addAlternateFile(mediaFile.id, {
        type: AlternateFileType.Poster,
        fileName: path.basename(poster),
        fileSize: stat.size,
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
        mimetype: "image/jpeg",
        duration: null,
        frameRate: null,
        bitRate: null,
      });

      try {
        let videoCodec = VideoCodec.H264;
        let audioCodec = AudioCodec.AAC;
        let container = Container.MP4;

        let fileName = `${baseName}-${videoCodec}.${container}`;
        logger.trace(`Re-encoding video using ${videoCodec} codec.`);
        let target = path.join(dir.path, fileName);
        let videoInfo = await encodeVideo(
          source,
          videoCodec,
          audioCodec,
          container,
          target,
        );

        await storage.storeFile(
          mediaId,
          mediaFile.id,
          fileName,
          target,
          `video/${videoInfo.format.container}`,
        );

        await dbConnection.addAlternateFile(mediaFile.id, {
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
      // Failure to re-encode doesn't need to block anything.
        logger.error(e, "Failed to re-encode video.");
      }
    }

    logger.trace("Building thumbnails.");
    for (let size of MEDIA_THUMBNAIL_SIZES) {
      let fileName = `${baseName}-${size}.jpg`;
      let target = path.join(dir.path, fileName);
      let info = await sharp(thumbnailSource)
        .resize(size, size, {
          fit: "inside",
        })
        .jpeg({
          quality: 90,
        })
        .toFile(target);

      await storage.storeFile(
        mediaId,
        mediaFile.id,
        fileName,
        target,
        `image/${info.format}`,
      );

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
    }

    await storage.storeFile(
      mediaId,
      mediaFile.id,
      mediaFile.fileName,
      source,
      mediaFile.mimetype,
    );
  } finally {
    await dir.cleanup();
  }
}

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

    let storage = await storageService.getStorage(media.catalog);
    try {
      let file = await storage.get().getUploadedFile(mediaId);
      if (!file) {
        logger.warn("No file found for media.");
        return;
      }

      let fileInfo = file;

      await dbConnection.withNewMediaFileId(
        mediaId,
        async (
          dbConnection: DatabaseConnection,
          mediaFileId: string,
          insert: (data: Omit<MediaFile, "id" | "media">) => Promise<MediaFile>,
        ): Promise<void> => {
          try {
            await extractMetadata(logger, storage.get(), fileInfo, mediaId, mediaFileId);

            let metadata = await parseExtractedMetadata(storage.get(), mediaId, mediaFileId);

            if (!ALLOWED_TYPES.includes(metadata.mimetype)) {
              await storage.get().deleteUploadedFile(mediaId);
              throw new Error(`Unrecognised mimetype: ${metadata.mimetype}`);
            }

            let mediaFile = await insert({
              ...metadata,
              processVersion: CURRENT_PROCESS_VERSION,
            });

            await encodeFile(
              logger,
              dbConnection,
              storage.get(),
              mediaId,
              mediaFile,
              fileInfo.path,
            );
          } catch (e) {
            await storage.get().deleteLocalFiles(mediaId, mediaFileId);
            throw e;
          }
        },
      );

      await storage.get().deleteUploadedFile(mediaId);
    } finally {
      storage.release();
    }
  },
);
