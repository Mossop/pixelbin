export const BackblazeStorageType = "backblaze";

export interface BackblazeConfig {
  type: typeof BackblazeStorageType;
  keyId: string;
  key: string;
  bucket: string;
  path: string;
}

export const ServerStorageType = "server";

export interface ServerConfig {
  type: typeof ServerStorageType;
}

export type StorageConfig = BackblazeConfig | ServerConfig;
