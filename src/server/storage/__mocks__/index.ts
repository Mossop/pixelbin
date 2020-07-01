import { RefCounted } from "../../../utils";

export const StorageMock = {
  copyUploadedFile: jest.fn((): Promise<void> => Promise.resolve()),

  getUploadedFile: jest.fn((): Promise<null> => Promise.resolve(null)),

  deleteUploadedFile: jest.fn((): Promise<void> => Promise.resolve()),
};

export const getStorage = jest.fn((_id: string): Promise<RefCounted<typeof StorageMock>> => {
  return Promise.resolve(new RefCounted(module.exports.StorageMock, (): void => {
    // Nothing to do.
  }));
});

export class StorageService {
  public getStorage = (id: string): Promise<RefCounted<typeof StorageMock>> => getStorage(id);
}
