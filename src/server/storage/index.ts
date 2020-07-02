import { promises as fs } from "fs";
import path from "path";

import { Cache, RefCounted, getLogger, Logger } from "../../utils";

const logger = getLogger("storage");

export interface StorageConfig {
  tempDirectory: string;
  localDirectory: string;
}

export interface FileInfo {
  name: string;
  path: string;
}

export class Storage {
  private readonly logger: Logger;

  public constructor(
    private readonly id: string,
    private readonly tempDirectory: string,
    private readonly localDirectory: string,
  ) {
    this.logger = logger.child({ id });
  }

  private getPath(root: string, storageId: string): string {
    return path.join(root, this.id, storageId);
  }

  public async copyUploadedFile(storageId: string, filepath: string, name: string): Promise<void> {
    let targetDir = this.getPath(this.tempDirectory, storageId);
    await fs.mkdir(targetDir, {
      recursive: true,
    });

    await fs.copyFile(filepath, path.join(targetDir, "uploaded"));

    let info: Omit<FileInfo, "path"> = {
      name,
    };
    await fs.writeFile(path.join(targetDir, "uploaded.meta"), JSON.stringify(info));
  }

  public async getUploadedFile(storageId: string): Promise<FileInfo | null> {
    let targetDir = this.getPath(this.tempDirectory, storageId);

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

      if (typeof meta == "object" && typeof meta.name == "string") {
        return {
          name: meta.name,
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

  public async deleteUploadedFile(storageId: string): Promise<void> {
    let targetDir = this.getPath(this.tempDirectory, storageId);
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

  public async getStorage(id: string): Promise<RefCounted<Storage>> {
    return this.cache.getOrCreate(id, (): Storage => {
      return new Storage(id, this.config.tempDirectory, this.config.localDirectory);
    });
  }
}
