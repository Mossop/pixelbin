const { RefCounted } = require("pixelbin-utils");

module.exports.StorageMock = {
  copyUploadedFile: jest.fn(() => Promise.resolve()),

  getUploadedFile: jest.fn(() => Promise.resolve(null)),

  deleteUploadedFile: jest.fn(() => Promise.resolve()),
};

module.exports.getStorage = jest.fn(() => {
  return Promise.resolve(new RefCounted(module.exports.StorageMock, () => {
    // Nothing to do.
  }));
});

module.exports.StorageService = class {
  constructor() {
    this.getStorage = module.exports.getStorage;
  }
};
