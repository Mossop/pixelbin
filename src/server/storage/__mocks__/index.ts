import { RefCounted } from "../../../utils";

export const StorageMock = {
  storeFile: jest.fn((): Promise<void> => Promise.resolve()),

  getLocalFilePath: jest.fn((): Promise<string> =>
    Promise.reject(new Error("No implementation provided."))),

  deleteLocalFiles: jest.fn((): Promise<void> => Promise.resolve()),

  copyUploadedFile: jest.fn((): Promise<void> => Promise.resolve()),

  getUploadedFile: jest.fn((): Promise<null> => Promise.resolve(null)),

  deleteUploadedFile: jest.fn((): Promise<void> => Promise.resolve()),
};

const getStorage = jest.fn((_id: string): Promise<RefCounted<typeof StorageMock>> => {
  return Promise.resolve(new RefCounted(StorageMock, (): void => {
    // Nothing to do.
  }));
});

export class StorageService {
  public getStorage: (id: string) => Promise<RefCounted<typeof StorageMock>> = getStorage;
}
