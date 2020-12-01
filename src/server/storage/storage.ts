import { promises as fs, createReadStream } from "fs";
import path from "path";

import type { DateTime, Logger } from "../../utils";
import { getLogger, now, parseDateTime } from "../../utils";
import type { DatabaseConnection } from "../database";
import { Remote } from "./remote";

export interface StoredFile {
  catalog: string;
  media: string;
  name: string | null;
  path: string;
  uploaded: DateTime;
}

const logger = getLogger("storage");

export class Storage {
  protected readonly logger: Logger;
  protected aws: Promise<Remote> | undefined;

  public constructor(
    protected readonly dbConnection: DatabaseConnection,
    protected readonly catalog: string,
    protected readonly tempDirectory: string,
    protected readonly localDirectory: string,
  ) {
    this.logger = logger.withBindings({ catalog });
  }

  protected get remote(): Promise<Remote> {
    if (!this.aws) {
      this.aws = Remote.getAWSRemote(this.dbConnection, this.catalog);
    }

    return this.aws;
  }

  public async getFileUrl(
    media: string,
    mediaFile: string,
    name: string,
    contentType?: string,
  ): Promise<string> {
    let remote = await this.remote;
    return remote.getUrl(path.join(media, mediaFile, name), contentType);
  }

  public async streamFile(
    media: string,
    mediaFile: string,
    name: string,
  ): Promise<NodeJS.ReadableStream> {
    let remote = await this.remote;
    return remote.stream(path.join(media, mediaFile, name));
  }

  public async storeFile(
    media: string,
    mediaFile: string,
    name: string,
    file: string,
    mimetype: string,
  ): Promise<void> {
    let remote = await this.remote;

    let stat = await fs.stat(file);
    let stream = createReadStream(file);

    await remote.upload(path.join(media, mediaFile, name), stream, stat.size, mimetype);
  }

  public async deleteFile(media: string, mediaFile: string, name: string): Promise<void> {
    let remote = await this.remote;
    await remote.delete([path.join(media, mediaFile, name)]);
  }

  public async deleteFiles(media: string, mediaFile: string, names: string[]): Promise<void> {
    let remote = await this.remote;
    await remote.delete(names.map((name: string): string => path.join(media, mediaFile, name)));
  }

  public async copyFile(
    media: string,
    oldMediaFile: string,
    oldName: string,
    newMediaFile: string,
    newName: string,
  ): Promise<void> {
    let remote = await this.remote;
    await remote.copy(
      path.join(media, oldMediaFile, oldName),
      path.join(media, newMediaFile, newName),
    );
  }

  public async getLocalFilePath(
    media: string,
    mediaFile: string,
    name: string,
  ): Promise<string> {
    let targetDir = path.join(this.localDirectory, this.catalog, media, mediaFile);
    await fs.mkdir(targetDir, {
      recursive: true,
    });

    return path.join(targetDir, name);
  }

  public async deleteLocalFiles(media: string, mediaFile?: string): Promise<void> {
    let targetDir = path.join(this.localDirectory, this.catalog, media);
    if (mediaFile) {
      targetDir = path.join(targetDir, mediaFile);
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

    let info: Omit<StoredFile, "path" | "catalog" | "media"> = {
      name: name.length ? name : null,
      uploaded: now(),
    };
    await fs.writeFile(path.join(targetDir, "uploaded.meta"), JSON.stringify(info));
  }

  public listUploadedFiles(): AsyncIterable<StoredFile> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let storage = this;
    return {
      async *[Symbol.asyncIterator](): AsyncIterator<StoredFile> {
        let medias = await fs.readdir(path.join(storage.tempDirectory, storage.catalog));
        for (let media of medias) {
          let file = await storage.getUploadedFile(media);
          if (file) {
            yield file;
          }
        }
      },
    };
  }

  public async getUploadedFile(media: string): Promise<StoredFile | null> {
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
          catalog: this.catalog,
          media,
          name: meta.name,
          uploaded: parseDateTime(meta.uploaded),
          path: path.join(targetDir, "uploaded"),
        };
      } else {
        logger.error({ meta }, "Uploaded metadata was malformed.");
      }
    } catch (error) {
      logger.error({ error }, "Failed getting uploaded file info.");
    }

    return null;
  }

  public async deleteUploadedFile(media: string): Promise<void> {
    let targetDir = path.join(this.tempDirectory, this.catalog, media);
    await fs.rmdir(targetDir, {
      recursive: true,
    });
  }

  public async inTransaction<T>(operation: (storage: Storage) => Promise<T>): Promise<T> {
    let transaction = new StorageTransaction(
      this.dbConnection,
      this.catalog,
      this.tempDirectory,
      this.localDirectory,
    );

    try {
      let result = await operation(transaction);
      return result;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }
}

class StorageTransaction extends Storage {
  protected localFiles: Set<string>;
  protected localDirs: Set<string>;
  protected remoteFiles: Map<string, Map<string, Set<string>>>;

  public constructor(
    dbConnection: DatabaseConnection,
    catalog: string,
    tempDirectory: string,
    localDirectory: string,
  ) {
    super(dbConnection, catalog, tempDirectory, localDirectory);
    this.localFiles = new Set();
    this.localDirs = new Set();
    this.remoteFiles = new Map();
  }

  private addRemoteFile(media: string, mediaFile: string, name: string): void {
    let mediaMap = this.remoteFiles.get(media);
    if (!mediaMap) {
      mediaMap = new Map();
      this.remoteFiles.set(media, mediaMap);
    }

    let fileSet = mediaMap.get(mediaFile);
    if (!fileSet) {
      fileSet = new Set();
      mediaMap.set(mediaFile, fileSet);
    }

    fileSet.add(name);
  }

  public async storeFile(
    media: string,
    mediaFile: string,
    name: string,
    file: string,
    mimetype: string,
  ): Promise<void> {
    this.addRemoteFile(media, mediaFile, name);
    return super.storeFile(media, mediaFile, name, file, mimetype);
  }

  public async copyFile(
    media: string,
    oldMediaFile: string,
    oldName: string,
    newMediaFile: string,
    newName: string,
  ): Promise<void> {
    this.addRemoteFile(media, newMediaFile, newName);
    return super.copyFile(media, oldMediaFile, oldName, newMediaFile, newName);
  }

  public async getLocalFilePath(
    media: string,
    mediaFile: string,
    name: string,
  ): Promise<string> {
    let dir = path.join(this.localDirectory, this.catalog, media, mediaFile);
    this.localDirs.add(dir);

    let file = await super.getLocalFilePath(media, mediaFile, name);
    this.localFiles.add(file);
    return file;
  }

  public async rollback(): Promise<void> {
    for (let [media, mediaMap] of this.remoteFiles) {
      for (let [mediaFile, fileSet] of mediaMap) {
        try {
          await this.deleteFiles(media, mediaFile, [...fileSet.values()]);
        } catch (error) {
          this.logger.error({ error }, "Failed to delete remote files.");
        }
      }
    }

    for (let file of this.localFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Might be already gone.
      }
    }

    for (let dir of this.localDirs) {
      try {
        await fs.rmdir(dir);
      } catch (error) {
        // Just means there were files left.
      }
    }
  }
}
