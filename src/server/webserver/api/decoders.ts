import { promises as fs } from "fs";

import { Files, File } from "formidable";
import { JsonDecoder } from "ts.data.json";

import { Api, Create, Patch } from "../../../model";
import { getLogger, DateDecoder, NumericDecoder, MappingDecoder } from "../../../utils";

type DeBlob<T> = T extends Blob ? File : T;

export type DeBlobbed<T> = {
  [K in keyof T]: DeBlob<T[K]>;
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

const LocationDecoder = JsonDecoder.object<Api.Location>({
  left: NumericDecoder,
  right: NumericDecoder,
  top: NumericDecoder,
  bottom: NumericDecoder,
}, "Location");

export const LoginRequest = jsonDecoder(JsonDecoder.object<Api.LoginRequest>({
  email: JsonDecoder.string,
  password: JsonDecoder.string,
}, "LoginRequest"));

export const SignupRequest = jsonDecoder(JsonDecoder.object<Api.SignupRequest>({
  email: JsonDecoder.string,
  password: JsonDecoder.string,
  fullname: JsonDecoder.string,
}, "SignupRequest"));

export const StorageTestRequest = jsonDecoder(
  JsonDecoder.object<Api.StorageTestRequest>({
    accessKeyId: JsonDecoder.string,
    secretAccessKey: JsonDecoder.string,
    bucket: JsonDecoder.string,
    region: JsonDecoder.string,
    path: JsonDecoder.nullable(JsonDecoder.string),
    endpoint: JsonDecoder.nullable(JsonDecoder.string),
    publicUrl: JsonDecoder.nullable(JsonDecoder.string),
  }, "StorageCreateDecoder"),
);

export const StorageCreateRequest = jsonDecoder(
  JsonDecoder.object<Api.StorageCreateRequest>({
    name: JsonDecoder.string,
    accessKeyId: JsonDecoder.string,
    secretAccessKey: JsonDecoder.string,
    bucket: JsonDecoder.string,
    region: JsonDecoder.string,
    path: JsonDecoder.nullable(JsonDecoder.string),
    endpoint: JsonDecoder.nullable(JsonDecoder.string),
    publicUrl: JsonDecoder.nullable(JsonDecoder.string),
  }, "StorageCreateDecoder"),
);

export const CatalogCreateRequest = jsonDecoder(
  JsonDecoder.object<Create<Api.Catalog>>({
    storage: JsonDecoder.string,
    name: JsonDecoder.string,
  }, "CatalogCreateReqeust"),
);

export const CatalogListRequest = jsonDecoder(JsonDecoder.object<Api.CatalogListRequest>({
  id: JsonDecoder.string,
}, "CatalogListRequest"));

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

export const AlbumListRequest = jsonDecoder(JsonDecoder.object<Api.AlbumListRequest>({
  id: JsonDecoder.string,
  recursive: MappingDecoder(
    JsonDecoder.string,
    (val: string): boolean => val == "true",
    "recursive",
  ),
}, "AlbumListRequest"));

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

export const TagFindRequest = jsonDecoder(JsonDecoder.object<Api.TagFindRequest>({
  catalog: JsonDecoder.string,
  tags: JsonDecoder.array(JsonDecoder.string, "tag[]"),
}, "TagFindRequest"));

export const PersonCreateRequest = jsonDecoder(JsonDecoder.object<Create<Api.Person>>({
  catalog: JsonDecoder.string,
  name: JsonDecoder.string,
}, "PersonCreateRequest"));

export const PersonEditRequest = jsonDecoder(JsonDecoder.object<Patch<Api.Person>>({
  id: JsonDecoder.string,
  name: JsonDecoder.optional(JsonDecoder.string),
}, "PersonEditRequest"));

export const MediaGetRequest = jsonDecoder(JsonDecoder.object<Api.MediaGetRequest>({
  id: JsonDecoder.string,
}, "MediaGetRequest"));

export const StringArray = jsonDecoder(JsonDecoder.array(JsonDecoder.string, "string[]"));

const SelectedTagDecoder = JsonDecoder.oneOf<Api.SelectedTag>([
  JsonDecoder.string,
  JsonDecoder.array(JsonDecoder.string, "string[]"),
], "SelectedTag");

const SelectedPersonDecoder = JsonDecoder.oneOf<Api.SelectedPerson>([
  JsonDecoder.string,
  JsonDecoder.object({
    id: JsonDecoder.string,
    location: JsonDecoder.optional(LocationDecoder),
  }, "Person"),
  JsonDecoder.object({
    name: JsonDecoder.string,
    location: JsonDecoder.optional(LocationDecoder),
  }, "Person"),
], "SelectedPerson");

const mediaFields = {
  filename: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  title: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  description: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  label: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  category: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  taken: JsonDecoder.optional(JsonDecoder.nullable(DateDecoder)),
  timeZone: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  longitude: JsonDecoder.optional(JsonDecoder.nullable(NumericDecoder)),
  latitude: JsonDecoder.optional(JsonDecoder.nullable(NumericDecoder)),
  altitude: JsonDecoder.optional(JsonDecoder.nullable(NumericDecoder)),
  location: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  city: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  state: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  country: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  orientation: JsonDecoder.optional(JsonDecoder.nullable(NumericDecoder)),
  make: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  model: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  lens: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  photographer: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  aperture: JsonDecoder.optional(JsonDecoder.nullable(NumericDecoder)),
  shutterSpeed: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  iso: JsonDecoder.optional(JsonDecoder.nullable(NumericDecoder)),
  focalLength: JsonDecoder.optional(JsonDecoder.nullable(NumericDecoder)),
  rating: JsonDecoder.optional(JsonDecoder.nullable(NumericDecoder)),
  albums: JsonDecoder.optional(JsonDecoder.array(JsonDecoder.string, "album[]")),
  tags: JsonDecoder.optional(JsonDecoder.array(SelectedTagDecoder, "SelectedTag[]")),
  people: JsonDecoder.optional(JsonDecoder.array(SelectedPersonDecoder, "SelectedPerson[]")),
};

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
    ...mediaFields,
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

export async function MediaUpdateRequest(
  data: unknown,
  files: Files | undefined,
): Promise<DeBlobbed<Api.MediaUpdateRequest>> {
  if (files) {
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
  }

  let decoder = JsonDecoder.object<DeBlobbed<Api.MediaUpdateRequest>>({
    id: JsonDecoder.string,
    file: JsonDecoder.constant(files?.file),
    ...mediaFields,
  }, "MediaUpdateRequest");

  try {
    return decoder.decodePromise(data);
  } catch (e) {
    if (files?.file) {
      try {
        await fs.unlink(files.file.path);
      } catch (e) {
        logger.warn(e, `Failed to delete temporary file ${files.file.path}`);
      }
    }

    throw e;
  }
}

const RelationTypeDecoder = JsonDecoder.oneOf([
  JsonDecoder.isExactly(Api.RelationType.Album),
  JsonDecoder.isExactly(Api.RelationType.Tag),
  JsonDecoder.isExactly(Api.RelationType.Person),
], "RelationType");

const MediaRelationChangeDecoder = JsonDecoder.oneOf<Api.MediaRelationChange>([
  JsonDecoder.object<Api.MediaRelationAdd>({
    operation: JsonDecoder.isExactly("add"),
    type: RelationTypeDecoder,
    media: JsonDecoder.array(JsonDecoder.string, "media[]"),
    items: JsonDecoder.array(JsonDecoder.string, "item[]"),
  }, "MediaRelationAdd"),
  JsonDecoder.object<Api.MediaRelationDelete>({
    operation: JsonDecoder.isExactly("delete"),
    type: RelationTypeDecoder,
    media: JsonDecoder.array(JsonDecoder.string, "media[]"),
    items: JsonDecoder.array(JsonDecoder.string, "item[]"),
  }, "MediaRelationDelete"),
  JsonDecoder.object<Api.MediaSetRelations>({
    operation: JsonDecoder.isExactly("setRelations"),
    type: RelationTypeDecoder,
    media: JsonDecoder.array(JsonDecoder.string, "media[]"),
    items: JsonDecoder.array(JsonDecoder.string, "item[]"),
  }, "MediaSetRelations"),
  JsonDecoder.object<Api.RelationsSetMedia>({
    operation: JsonDecoder.isExactly("setMedia"),
    type: RelationTypeDecoder,
    items: JsonDecoder.array(JsonDecoder.string, "item[]"),
    media: JsonDecoder.array(JsonDecoder.string, "media[]"),
  }, "RelationsSetMedia"),
], "MediaRelationChange");

export const MediaRelationsRequest = jsonDecoder(JsonDecoder.array(
  MediaRelationChangeDecoder,
  "MediaRelationChange[]",
));

const MediaPersonLocationDecoder = JsonDecoder.object<Api.MediaPersonLocation>({
  media: JsonDecoder.string,
  person: JsonDecoder.string,
  location: JsonDecoder.optional(LocationDecoder),
}, "MediaPersonLocation");

export const MediaPersonLocations = jsonDecoder(JsonDecoder.array(
  MediaPersonLocationDecoder,
  "MediaPersonLocation[]",
));
