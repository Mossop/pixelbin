import { StorageService } from "../storage";

export interface ServicesContext {
  storage: StorageService;
}

export default function(storage: StorageService): Record<string, PropertyDescriptor> {
  return {
    storage: {
      get(): StorageService {
        return storage;
      },
    },
  };
}

