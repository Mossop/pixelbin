import { Cache, RefCounted } from "../../utils";
import { DatabaseConnection } from "../database";
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
