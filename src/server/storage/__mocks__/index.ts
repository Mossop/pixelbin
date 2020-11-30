import { RefCounted } from "../../../utils";

export const StorageMock = {
  getFileUrl: jest.fn((): Promise<string> => Promise.resolve("")),

  streamFile: jest.fn((): Promise<void> => Promise.reject()),

  copyFile: jest.fn((): Promise<void> => Promise.resolve()),

  deleteFile: jest.fn((): Promise<void> => Promise.resolve()),

  storeFile: jest.fn((): Promise<void> => Promise.resolve()),

  getLocalFilePath: jest.fn((): Promise<string> =>
    Promise.reject(new Error("No implementation provided."))),

  deleteLocalFiles: jest.fn((): Promise<void> => Promise.resolve()),

  copyUploadedFile: jest.fn((): Promise<void> => Promise.resolve()),

  getUploadedFile: jest.fn((): Promise<null> => Promise.resolve(null)),

  deleteUploadedFile: jest.fn((): Promise<void> => Promise.resolve()),

  rollback: jest.fn(() => Promise.resolve()),

  async inTransaction<T>(this: Storage, operation: (storage: Storage) => Promise<T>): Promise<T> {
    try {
      let result = await operation(this);
      return result;
    } catch (e) {
      await this.rollback();
      throw e;
    }
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
