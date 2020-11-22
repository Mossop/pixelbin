import { RefCounted } from "../../../utils";

export const StorageMock = {
  getFileUrl: jest.fn((): Promise<string> => Promise.resolve("")),

  streamFile: jest.fn((): Promise<void> => Promise.reject()),

  deleteFile: jest.fn((): Promise<void> => Promise.resolve()),

  storeFile: jest.fn((): Promise<void> => Promise.resolve()),

  getLocalFilePath: jest.fn((): Promise<string> =>
    Promise.reject(new Error("No implementation provided."))),

  deleteLocalFiles: jest.fn((): Promise<void> => Promise.resolve()),

  copyUploadedFile: jest.fn((): Promise<void> => Promise.resolve()),

  getUploadedFile: jest.fn((): Promise<null> => Promise.resolve(null)),

  deleteUploadedFile: jest.fn((): Promise<void> => Promise.resolve()),

  inTransaction<T>(this: Storage, operation: (storage: Storage) => Promise<T>): Promise<T> {
    return operation(this);
  },
};

const getStorage = jest.fn((_id: string): Promise<RefCounted<typeof StorageMock>> => {
  return Promise.resolve(new RefCounted(StorageMock, (): void => {
    // Nothing to do.
  }));
});

export class StorageService {
  public getStorage: (id: string) => Promise<RefCounted<typeof StorageMock>> = getStorage;
}
