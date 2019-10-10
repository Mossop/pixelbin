import { UIManager } from "../utils/uicontext";

export const BackblazeStorageType = "backblaze";

export interface BackblazeConfig {
  type: typeof BackblazeStorageType;
  keyId: string;
  key: string;
  bucket: string;
  path: string;
}

export type StorageConfig = BackblazeConfig;

interface StorageConfigProps {
  disabled: boolean;
}

export abstract class StorageConfigUI extends UIManager<StorageConfigProps> {
  public abstract getStorageConfig(): StorageConfig;
}
