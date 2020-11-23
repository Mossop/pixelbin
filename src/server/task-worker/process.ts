import { createWriteStream, promises as fs } from "fs";
import path from "path";

import sharp from "sharp";
import type { Sharp } from "sharp";
import type { DirectoryResult } from "tmp-promise";
import { dir as tmpdir } from "tmp-promise";

import { AlternateFileType, CURRENT_PROCESS_VERSION } from "../../model";
import type { Logger, RefCounted } from "../../utils";
import { parseDateTime } from "../../utils";
import type { DatabaseConnection, MediaFile } from "../database";
import type { Storage, StoredFile } from "../storage";
import { extractFrame, encodeVideo, VideoCodec, AudioCodec, Container } from "./ffmpeg";
import { parseFile, parseMetadata, getMediaFile, baseMimetype } from "./metadata";
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
  private imageSource: Sharp | undefined;
  private baseName: string;
  private processes: Promise<void>[];

  public constructor(
    private readonly logger: Logger,
    private readonly dbConnection: DatabaseConnection,
    private readonly storage: Storage,
    private readonly dir: DirectoryResult,
    private readonly mediaId: string,
    private readonly mediaFile: MediaFile,
    private readonly source: string,
  ) {
    this.baseName = basename(mediaFile.fileName);
    this.processes = [];
  }

  private addProcess(process: Promise<void>): void {
    this.processes.push(process);
  }

  private async finish(): Promise<void> {
    let processes = this.processes.splice(0);

    try {
      await Promise.all(processes);
    } finally {
      await Promise.allSettled(processes);
    }
  }

  private async buildThumbnails(): Promise<void> {
    if (!this.imageSource) {
      throw new Error("Not initialized.");
    }

    this.logger.trace("Building thumbnails.");

    for (let size of MEDIA_THUMBNAIL_SIZES) {
      let thumb = this.imageSource
        .clone()
        .resize(size, size, {
          fit: "inside",
        });

      let fileName = `${this.baseName}-${size}.jpg`;
      this.storeImage(
        thumb.clone().jpeg({
          quality: 80,
        }),
        AlternateFileType.Thumbnail,
        fileName,
      );

      fileName = `${this.baseName}-${size}.webp`;
      this.storeImage(
        thumb.clone().webp({
          quality: 70,
          reductionEffort: 6,
        }),
        AlternateFileType.Thumbnail,
        fileName,
      );
    }
  }

  private async reencodeVideo(): Promise<void> {
    let videoCodec = VideoCodec.H264;
    let audioCodec = AudioCodec.AAC;
    let container = Container.MP4;

    let fileName = `${this.baseName}-${videoCodec}.${container}`;
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
      videoInfo.format.mimetype,
    );

    await this.dbConnection.addAlternateFile(this.mediaFile.id, {
      type: AlternateFileType.Reencode,
      fileName,
      fileSize: videoInfo.format.size,
      width: videoInfo.videoStream?.width ?? 0,
      height: videoInfo.videoStream?.height ?? 0,
      mimetype: videoInfo.format.mimetype,
      duration: videoInfo.format.duration,
      bitRate: videoInfo.format.bitRate,
      frameRate: videoInfo.videoStream?.frameRate ?? null,
    });
  }

  private storeImage(image: Sharp, type: AlternateFileType, name: string): void {
    const doStore = async (): Promise<void> => {
      let target = path.join(this.dir.path, name);
      let info = await image.toFile(target);

      await this.storage.storeFile(
        this.mediaId,
        this.mediaFile.id,
        name,
        target,
        `image/${info.format}`,
      );

      await this.dbConnection.addAlternateFile(this.mediaFile.id, {
        type,
        fileName: name,
        fileSize: info.size,
        width: info.width,
        height: info.height,
        mimetype: `image/${info.format}`,
        duration: null,
        frameRate: null,
        bitRate: null,
      });
    };

    this.addProcess(doStore());
  }

  private reencodeImage(): void {
    if (!this.imageSource) {
      throw new Error("Not initialized.");
    }

    this.logger.trace("Re-encoding image");

    this.storeImage(
      this.imageSource.clone().webp({
        quality: 80,
        reductionEffort: 6,
      }),
      AlternateFileType.Reencode,
      `${this.baseName}-webp.webp`,
    );

    this.storeImage(
      this.imageSource.clone().jpeg({
        quality: 90,
      }),
      AlternateFileType.Reencode,
      `${this.baseName}-jpg.jpg`,
    );
  }

  public async buildImageSource(): Promise<void> {
    let baseImage = this.source;
    if (this.mediaFile.mimetype.startsWith("video/")) {
      baseImage = path.join(this.dir.path, "extracted");
      await extractFrame(this.source, baseImage);
    }

    let base = sharp(baseImage);
    let { width, height, channels, icc } = await base.clone().metadata();

    if (!width || !height || !channels) {
      throw new Error("Unable to extract image metadata.");
    }

    let buffer = await base.raw().toBuffer();

    this.imageSource = sharp(buffer, {
      raw: {
        width: width,
        height: height,
        channels: channels,
      },
    });

    if (icc) {
      let iccFile = path.join(this.dir.path, "icc");
      await fs.writeFile(iccFile, icc);
      this.imageSource = this.imageSource.withMetadata({
        // @ts-ignore: Outdated types.
        icc: iccFile,
      });
    }
  }

  public async processMedia(): Promise<void> {
    try {
      await this.buildImageSource();

      if (this.mediaFile.mimetype.startsWith("video/")) {
        this.addProcess(this.reencodeVideo());
      }

      this.reencodeImage();

      this.addProcess(this.buildThumbnails());

      this.addProcess(this.storage.storeFile(
        this.mediaId,
        this.mediaFile.id,
        this.mediaFile.fileName,
        this.source,
        this.mediaFile.mimetype,
      ));
    } finally {
      await this.finish();
    }
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

        let type = baseMimetype(metadata.mimetype);
        if (!ALLOWED_TYPES.includes(type)) {
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

export const fullReprocess = bindTask(
  async function fullReprocess(logger: Logger, mediaId: string): Promise<void> {
    logger = logger.withBindings({
      media: mediaId,
    });

    let dbConnection = await Services.database;

    let media = await dbConnection.getMedia(mediaId);
    if (!media) {
      logger.warn("Media does not exist.");
      return;
    }

    if (!media.file) {
      logger.warn("Media is not yet processed.");
      return;
    }

    if (media.file.processVersion >= CURRENT_PROCESS_VERSION) {
      logger.warn("Media is already processed.");
      return;
    }

    logger.info({ media: mediaId }, "Reprocessing media");

    let storageService = await Services.storage;

    let dir = await tmpdir({
      unsafeCleanup: true,
    });
    let storage = await storageService.getStorage(media.catalog);
    try {
      let original = path.join(dir.path, "original");
      let writeStream = createWriteStream(original);
      let readStream = await storage.get().streamFile(mediaId, media.file.id, media.file.fileName);

      let finished = new Promise<void>(
        (
          resolve: () => void,
          reject: (error: Error) => void,
        ): void => {
          writeStream.on("error", reject);
          readStream.on("error", reject);
          writeStream.on("close", resolve);
        },
      );

      readStream.pipe(writeStream);

      await finished;

      let metadataFile = await storage.get().getLocalFilePath(
        mediaId,
        media.file.id,
        "metadata.json",
      );

      let oldData = JSON.parse(await fs.readFile(metadataFile, {
        encoding: "utf8",
      }));

      let file: StoredFile = {
        path: original,
        name: oldData.fileName,
        media: mediaId,
        catalog: media.catalog,
        uploaded: parseDateTime(oldData.uploaded),
      };

      let data = await parseFile(file);

      let metadata: Omit<MediaFile, "id" | "media" | "processVersion"> = {
        ...parseMetadata(data),
        ...getMediaFile(data),
      };

      await storage.get().inTransaction(async (storage: Storage): Promise<void> => {
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

            let processor = new MediaProcessor(
              logger,
              dbConnection,
              storage,
              dir,
              mediaId,
              mediaFile,
              original,
            );

            await processor.processMedia();
            logger.info("Reprocess complete.");
          },
        );
      });
    } finally {
      storage.release();
      await dir.cleanup();
    }
  },
);
