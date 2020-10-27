import { promises as fs } from "fs";

import type { RefCounted } from "../../utils";
import { Cache } from "../../utils";
import type { DatabaseConnection } from "../database";
import type { StoredFile } from "./storage";
import { Storage } from "./storage";

export interface StorageConfig {
  tempDirectory: string;
  localDirectory: string;
}

export class StorageService {
  private cache: Cache<string, Storage>;

  public constructor(
    private readonly config: StorageConfig,
    private readonly dbConnection: DatabaseConnection,
  ) {
    this.cache = new Cache();
  }

  public listUploadedFiles(): AsyncIterable<StoredFile> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let service = this;
    return {
      async *[Symbol.asyncIterator](): AsyncIterator<StoredFile> {
        let catalogs = await fs.readdir(service.config.tempDirectory);
        for (let catalog of catalogs) {
          let storage = await service.getStorage(catalog);
          try {
            yield* storage.get().listUploadedFiles();
          } finally {
            storage.release();
          }
        }
      },
    };
  }

  public async getStorage(catalog: string): Promise<RefCounted<Storage>> {
    return this.cache.getOrCreate(catalog, (): Storage => {
      return new Storage(
        this.dbConnection,
        catalog,
        this.config.tempDirectory,
        this.config.localDirectory,
      );
    });
  }
}
