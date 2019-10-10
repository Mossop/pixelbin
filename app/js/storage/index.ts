import { StorageConfigUI } from "./types";
import { BackblazeConfigUI } from "./backblaze";

export { StorageConfigUI };

export function getStorageConfigUI(type: string): new(props: {}) => StorageConfigUI {
  switch (type) {
    case "backblaze":
      return BackblazeConfigUI;
    default:
      throw new Error(`Attempted to use unknown storage: '${type}'`);
  }
}
