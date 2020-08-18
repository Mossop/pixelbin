import { promises as fs } from "fs";

import { Files, File } from "formidable";
import { JsonDecoder } from "ts.data.json";

import { Api, Create, Patch } from "../../../model";
import { getLogger, DateDecoder, NumericDecoder } from "../../../utils";

export type DeBlobbed<T> = {
  [K in keyof T]: T[K] extends Blob ? File : T[K];
};

const logger = getLogger("jsonDecoder");

function jsonDecoder<R>(decoder: JsonDecoder.Decoder<R>): Api.RequestDecoder<R> {
  return async (data: unknown, files: Files | undefined): Promise<R> => {
    if (files) {
      for (let file of Object.values(files)) {
        try {
          await fs.unlink(file.path);
        } catch (e) {
          logger.warn(e, `Failed to delete temporary file ${file.path}`);
        }
      }
    }
    return decoder.decodePromise(data);
  };
}

export const LoginRequest = jsonDecoder(JsonDecoder.object<Api.LoginRequest>({
  email: JsonDecoder.string,
  password: JsonDecoder.string,
}, "LoginRequest"));

const StorageCreateDecoder = JsonDecoder.object<Create<Api.Storage>>({
  name: JsonDecoder.string,
  accessKeyId: JsonDecoder.string,
  secretAccessKey: JsonDecoder.string,
  region: JsonDecoder.string,
  bucket: JsonDecoder.string,
  path: JsonDecoder.nullable(JsonDecoder.string),
  endpoint: JsonDecoder.nullable(JsonDecoder.string),
  publicUrl: JsonDecoder.nullable(JsonDecoder.string),
}, "StorageCreateDecoder");

export const CatalogCreateRequest = jsonDecoder(
  JsonDecoder.object<Api.CatalogCreateRequest>({
    storage: JsonDecoder.oneOf<string | Create<Api.Storage>>([
      JsonDecoder.string,
      StorageCreateDecoder,
    ], "StorageCreate"),
    name: JsonDecoder.string,
  }, "CatalogCreateReqeust"),
);

export const AlbumCreateRequest = jsonDecoder(JsonDecoder.object<Create<Api.Album>>({
  catalog: JsonDecoder.string,
  name: JsonDecoder.string,
  parent: JsonDecoder.nullable(JsonDecoder.string),
}, "AlbumCreateRequest"));

export const AlbumEditRequest = jsonDecoder(JsonDecoder.object<Patch<Api.Album>>({
  id: JsonDecoder.string,
  name: JsonDecoder.optional(JsonDecoder.string),
  parent: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
}, "AlbumEditRequest"));

export const TagCreateRequest = jsonDecoder(JsonDecoder.object<Create<Api.Tag>>({
  catalog: JsonDecoder.string,
  name: JsonDecoder.string,
  parent: JsonDecoder.nullable(JsonDecoder.string),
}, "TagCreateRequest"));

export const TagEditRequest = jsonDecoder(JsonDecoder.object<Patch<Api.Tag>>({
  id: JsonDecoder.string,
  name: JsonDecoder.optional(JsonDecoder.string),
  parent: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
}, "TagEditRequest"));

export const PersonCreateRequest = jsonDecoder(JsonDecoder.object<Create<Api.Person>>({
  catalog: JsonDecoder.string,
  name: JsonDecoder.string,
}, "PersonCreateRequest"));

export const PersonEditRequest = jsonDecoder(JsonDecoder.object<Patch<Api.Person>>({
  id: JsonDecoder.string,
  name: JsonDecoder.optional(JsonDecoder.string),
}, "PersonEditRequest"));

export async function MediaCreateRequest(
  data: unknown,
  files: Files | undefined,
): Promise<DeBlobbed<Api.MediaCreateRequest>> {
  if (!files || !("file" in files)) {
    throw new Error("No file provided.");
  }

  for (let [name, file] of Object.entries(files)) {
    if (name == "file") {
      continue;
    }

    try {
      await fs.unlink(file.path);
    } catch (e) {
      logger.warn(e, `Failed to delete temporary file ${file.path}`);
    }
  }

  let decoder = JsonDecoder.object<DeBlobbed<Api.MediaCreateRequest>>({
    file: JsonDecoder.constant(files.file),
    catalog: JsonDecoder.string,
    filename: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
    title: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
    taken: JsonDecoder.optional(JsonDecoder.nullable(DateDecoder)),
    timeZone: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
    longitude: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.number)),
    latitude: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.number)),
    altitude: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.number)),
    location: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
    city: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
    state: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
    country: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
    orientation: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.number)),
    make: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
    model: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
    lens: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
    photographer: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
    aperture: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.number)),
    exposure: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.number)),
    iso: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.number)),
    focalLength: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.number)),
    albums: JsonDecoder.optional(JsonDecoder.array(JsonDecoder.string, "album[]")),
    tags: JsonDecoder.optional(JsonDecoder.array(JsonDecoder.string, "tag[]")),
    people: JsonDecoder.optional(JsonDecoder.array(JsonDecoder.string, "person[]")),
  }, "MediaCreateRequest");

  try {
    return decoder.decodePromise(data);
  } catch (e) {
    try {
      await fs.unlink(files.file.path);
    } catch (e) {
      logger.warn(e, `Failed to delete temporary file ${files.file.path}`);
    }

    throw e;
  }
}

export const MediaThumbnailRequest = jsonDecoder(JsonDecoder.object<Api.MediaThumbnailRequest>({
  id: JsonDecoder.string,
  size: NumericDecoder,
}, "MediaThumbnailRequest"));
