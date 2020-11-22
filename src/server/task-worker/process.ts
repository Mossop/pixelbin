import { promises as fs } from "fs";
import path from "path";

import sharp from "sharp";
import type { DirectoryResult } from "tmp-promise";
import { dir as tmpdir } from "tmp-promise";

import { AlternateFileType } from "../../model";
import { CURRENT_PROCESS_VERSION } from "../../model/models";
import type { Logger, RefCounted } from "../../utils";
import type { DatabaseConnection, MediaFile } from "../database";
import type { Storage } from "../storage";
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

function basename(source: string): string {
  return source.substr(0, source.length - path.extname(source).length);
}
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

class MediaProcessor {
  private imageSource: string;
  private baseName: string;

  public constructor(
    private readonly logger: Logger,
    private readonly dbConnection: DatabaseConnection,
    private readonly storage: Storage,
    private readonly dir: DirectoryResult,
    private readonly mediaId: string,
    private readonly mediaFile: MediaFile,
    private readonly source: string,
  ) {
    this.imageSource = source;
    this.baseName = basename(mediaFile.fileName);
  }

  private async buildThumbnails(): Promise<void> {
    this.logger.trace("Building thumbnails.");

    for (let size of MEDIA_THUMBNAIL_SIZES) {
      let fileName = `${this.baseName}-${size}.jpg`;
      let target = path.join(this.dir.path, fileName);
      let info = await sharp(this.imageSource)
        .resize(size, size, {
          fit: "inside",
        })
        .jpeg({
          quality: 90,
        })
        .toFile(target);

      await this.storage.storeFile(
        this.mediaId,
        this.mediaFile.id,
        fileName,
        target,
        `image/${info.format}`,
      );

      await this.dbConnection.addAlternateFile(this.mediaFile.id, {
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
  }

  private async buildPoster(): Promise<void> {
    this.logger.trace("Generating video poster frame.");

    this.imageSource = path.join(this.dir.path, `${this.baseName}-poster.jpg`);
    await extractFrame(this.source, this.imageSource);

    await this.storage.storeFile(
      this.mediaId,
      this.mediaFile.id,
      path.basename(this.imageSource),
      this.imageSource,
      "image/jpeg",
    );

    let stat = await fs.stat(this.imageSource);
    let metadata = await sharp(this.imageSource).metadata();
    await this.dbConnection.addAlternateFile(this.mediaFile.id, {
      type: AlternateFileType.Poster,
      fileName: path.basename(this.imageSource),
      fileSize: stat.size,
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      mimetype: "image/jpeg",
      duration: null,
      frameRate: null,
      bitRate: null,
    });
  }

  private async reencodeVideo(): Promise<void> {
    let videoCodec = VideoCodec.H264;
    let audioCodec = AudioCodec.AAC;
    let container = Container.MP4;

    let fileName = `${basename(this.mediaFile.fileName)}-${videoCodec}.${container}`;
    this.logger.trace(`Re-encoding video using ${videoCodec} codec.`);
    let target = path.join(this.dir.path, fileName);
    let videoInfo = await encodeVideo(
      this.source,
      videoCodec,
      audioCodec,
      container,
      target,
    );

    await this.storage.storeFile(
      this.mediaId,
      this.mediaFile.id,
      fileName,
      target,
      `video/${videoInfo.format.container}`,
    );

    await this.dbConnection.addAlternateFile(this.mediaFile.id, {
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
  }

  private async reencodeImage(): Promise<void> {
    // no-op
  }

  public async processMedia(): Promise<void> {
    if (this.mediaFile.mimetype.startsWith("video/")) {
      await this.buildPoster();

      await this.reencodeVideo();
    } else {
      await this.reencodeImage();
    }

    await this.buildThumbnails();

    await this.storage.storeFile(
      this.mediaId,
      this.mediaFile.id,
      this.mediaFile.fileName,
      this.source,
      this.mediaFile.mimetype,
    );
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
      await storage.get().inTransaction(async (storage: Storage): Promise<void> => {
        let file = await storage.getUploadedFile(mediaId);
        if (!file) {
          logger.warn("No file found for media.");
          return;
        }

        let fileInfo = file;
        let data = await parseFile(fileInfo);
        let metadata: Omit<MediaFile, "id" | "media" | "processVersion"> = {
          ...parseMetadata(data),
          ...getMediaFile(data),
        };

        if (!ALLOWED_TYPES.includes(metadata.mimetype)) {
          await storage.deleteUploadedFile(mediaId);
          throw new Error(`Unrecognised mimetype: ${metadata.mimetype}`);
        }

        await dbConnection.withNewMediaFile(
          mediaId,
          {
            ...metadata,
            processVersion: CURRENT_PROCESS_VERSION,
          },
          async (
            dbConnection: DatabaseConnection,
            mediaFile: MediaFile,
          ): Promise<void> => {
            let metadataFile = await storage.getLocalFilePath(
              mediaId,
              mediaFile.id,
              "metadata.json",
            );

            await fs.writeFile(metadataFile, JSON.stringify(data));

            let dir = await tmpdir({
              unsafeCleanup: true,
            });

            try {
              let processor = new MediaProcessor(
                logger,
                dbConnection,
                storage,
                dir,
                mediaId,
                mediaFile,
                fileInfo.path,
              );

              await processor.processMedia();
            } finally {
              await dir.cleanup();
            }
          },
        );

        await storage.deleteUploadedFile(mediaId);
      });
    } finally {
      storage.release();
    }
  },
);
