import { Field } from "../content/Form";
import { StorageConfig, ServerStorageType } from "./types";
import { getBackblazeConfigUI, getBackblazeConfig } from "./backblaze";
import { UIManager } from "../utils/UIState";

export function getStorageConfigUI(type: string): Field[] {
  switch (type) {
    case "backblaze":
      return getBackblazeConfigUI();
    case "server":
      return [];
    default:
      throw new Error(`Attempted to use unknown storage: '${type}'`);
  }
}

export function getStorageConfig(type: string, state: UIManager): StorageConfig {
  switch (type) {
    case "backblaze":
      return getBackblazeConfig(state);
    case "server":
      return {
        type: ServerStorageType,
      };
    default:
      throw new Error(`Attempted to use unknown storage: '${type}'`);
  }
}
