import { UIManager } from "../utils/uicontext";
import { BackblazeConfigUI, BackblazeConfig } from "./backblaze";

export type StorageConfig = BackblazeConfig;

interface StorageConfigProps {
  disabled: boolean;
}

export abstract class StorageConfigUI extends UIManager<StorageConfigProps> {
  public abstract getStorageConfig(): StorageConfig;
}

export function getStorageConfigUI(type: string): new(props: {}) => StorageConfigUI {
  switch (type) {
    case "backblaze":
      return BackblazeConfigUI;
    default:
      throw new Error(`Attempted to use unknown storage: '${type}'`);
  }
}
