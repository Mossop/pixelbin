import { Cache, RefCounted } from "../../utils";
import { Storage } from "./storage";

export interface StorageConfig {
  tempDirectory: string;
  localDirectory: string;
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
