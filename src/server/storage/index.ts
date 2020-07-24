import { promises as fs, createReadStream } from "fs";
import path from "path";

import moment, { Moment } from "moment-timezone";

import { Cache, RefCounted, getLogger, Logger } from "../../utils";
import { Remote } from "./aws";

const logger = getLogger("storage");

export interface StorageConfig {
  tempDirectory: string;
  localDirectory: string;
}

export interface FileInfo {
  name: string | null;
  path: string;
  uploaded: Moment;
}

export class Storage {
  private readonly logger: Logger;
  private aws: Promise<Remote> | undefined;

  public constructor(
    private readonly catalog: string,
    private readonly tempDirectory: string,
    private readonly localDirectory: string,
  ) {
    this.logger = logger.child({ catalog });
  }

  private get remote(): Promise<Remote> {
    if (!this.aws) {
      this.aws = Remote.getAWSRemote(this.catalog);
    }

    return this.aws;
  }

  public async getFileUrl(media: string, mediaInfo: string, name: string): Promise<string> {
    let remote = await this.remote;
    return remote.getUrl(path.join(media, mediaInfo, name));
  }

  public async streamFile(
    media: string,
    mediaInfo: string,
    name: string,
  ): Promise<NodeJS.ReadableStream> {
    let remote = await this.remote;
    return remote.stream(path.join(media, mediaInfo, name));
  }

  public async storeFile(
    media: string,
    mediaInfo: string,
    name: string,
    file: string,
  ): Promise<void> {
    let remote = await this.remote;

    let stat = await fs.stat(file);
    let stream = createReadStream(file);

    await remote.upload(path.join(media, mediaInfo, name), stream, stat.size);
  }

  public async deleteFile(media: string, mediaInfo: string, name: string): Promise<void> {
    let remote = await this.remote;
    await remote.delete(path.join(media, mediaInfo, name));
  }

  public async getLocalFilePath(media: string, mediaInfo: string, name: string): Promise<string> {
    let targetDir = path.join(this.localDirectory, this.catalog, media, mediaInfo);
    await fs.mkdir(targetDir, {
      recursive: true,
    });

    return path.join(targetDir, name);
  }

  public async deleteLocalFiles(media: string, mediaInfo?: string): Promise<void> {
    let targetDir = path.join(this.localDirectory, this.catalog, media);
    if (mediaInfo) {
      targetDir = path.join(targetDir, mediaInfo);
    }
    await fs.rmdir(targetDir, {
      recursive: true,
    });
  }

  public async copyUploadedFile(media: string, filepath: string, name: string): Promise<void> {
    let targetDir = path.join(this.tempDirectory, this.catalog, media);
    await fs.mkdir(targetDir, {
      recursive: true,
    });

    await fs.copyFile(filepath, path.join(targetDir, "uploaded"));

    let info: Omit<FileInfo, "path"> = {
      name: name.length ? name : null,
      uploaded: moment(),
    };
    await fs.writeFile(path.join(targetDir, "uploaded.meta"), JSON.stringify(info));
  }

  public async getUploadedFile(media: string): Promise<FileInfo | null> {
    let targetDir = path.join(this.tempDirectory, this.catalog, media);

    try {
      let stat = await fs.stat(path.join(targetDir, "uploaded"));
      if (!stat.isFile()) {
        return null;
      }

      let metaPath = path.join(targetDir, "uploaded.meta");
      stat = await fs.stat(metaPath);
      if (!stat.isFile()) {
        return null;
      }

      let meta = JSON.parse(await fs.readFile(metaPath, {
        encoding: "utf8",
      }));

      if (typeof meta == "object") {
        return {
          name: meta.name,
          uploaded: moment(meta.uploaded),
          path: path.join(targetDir, "uploaded"),
        };
      } else {
        logger.error({ meta }, "Uploaded metadata was malformed.");
      }
    } catch (e) {
      logger.error(e, "Failed getting uploaded file info.");
    }

    return null;
  }

  public async deleteUploadedFile(media: string): Promise<void> {
    let targetDir = path.join(this.tempDirectory, this.catalog, media);
    await fs.rmdir(targetDir, {
      recursive: true,
    });
  }
}

export class StorageService {
  private cache: Cache<string, Storage>;

  public constructor(
    private readonly config: StorageConfig,
  ) {
    this.cache = new Cache();
  }

  public async getStorage(catalog: string): Promise<RefCounted<Storage>> {
    return this.cache.getOrCreate(catalog, (): Storage => {
      return new Storage(catalog, this.config.tempDirectory, this.config.localDirectory);
    });
  }
}
