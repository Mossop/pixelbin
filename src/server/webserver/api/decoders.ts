import { promises as fs } from "fs";

import type { Files, File } from "formidable";
import { JsonDecoder } from "ts.data.json";

import type { Api, ObjectModel, Requests } from "../../../model";
import { Orientation, RelationType } from "../../../model";
import {
  getLogger,
  DateDecoder,
  NumericDecoder,
  MappingDecoder,
  QueryDecoder,
  oneOf,
} from "../../../utils";

type DeBlob<T> = T extends Blob ? File : T;

export type DeBlobbed<T> = {
  [K in keyof T]: DeBlob<T[K]>;
};

const logger = getLogger("webserver/jsonDecoder");

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

export const StringArray = jsonDecoder(JsonDecoder.array(JsonDecoder.string, "string[]"));

function OptionalOrNullDecoder<A>(
  decoder: JsonDecoder.Decoder<A>,
  name: string,
): JsonDecoder.Decoder<A | null | undefined> {
  return JsonDecoder.oneOf([
    JsonDecoder.isNull(null),
    JsonDecoder.optional(decoder),
  ], name);
}

export const LoginRequest = jsonDecoder(JsonDecoder.object<Requests.Login>({
  email: JsonDecoder.string,
  password: JsonDecoder.string,
}, "LoginRequest"));

export const SignupRequest = jsonDecoder(JsonDecoder.object<Requests.Signup>({
  email: JsonDecoder.string,
  password: JsonDecoder.string,
  fullname: JsonDecoder.string,
}, "SignupRequest"));

export const StorageTestRequest = jsonDecoder(
  JsonDecoder.object<Requests.StorageTest>({
    accessKeyId: JsonDecoder.string,
    secretAccessKey: JsonDecoder.string,
    bucket: JsonDecoder.string,
    region: JsonDecoder.string,
    path: JsonDecoder.nullable(JsonDecoder.string),
    endpoint: JsonDecoder.nullable(JsonDecoder.string),
    publicUrl: JsonDecoder.nullable(JsonDecoder.string),
  }, "StorageTestDecoder"),
);

export const StorageCreateRequest = jsonDecoder(
  JsonDecoder.object<Requests.StorageCreate>({
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
  JsonDecoder.object<Requests.CatalogCreate>({
    storage: JsonDecoder.string,
    catalog: JsonDecoder.object({
      name: JsonDecoder.string,
    }, "Catalog"),
  }, "CatalogCreateReqeust"),
);

export const CatalogEditRequest = jsonDecoder(
  JsonDecoder.object<Requests.CatalogEdit>({
    id: JsonDecoder.string,
    catalog: JsonDecoder.object({
      name: JsonDecoder.optional(JsonDecoder.string),
    }, "Catalog"),
  }, "CatalogEditRequest"),
);

export const CatalogListRequest = jsonDecoder(JsonDecoder.object<Requests.CatalogList>({
  id: JsonDecoder.string,
}, "CatalogListRequest"));

export const AlbumCreateRequest = jsonDecoder(JsonDecoder.object<Requests.AlbumCreate>({
  catalog: JsonDecoder.string,
  album: JsonDecoder.object({
    name: JsonDecoder.string,
    parent: JsonDecoder.nullable(JsonDecoder.string),
  }, "Album"),
}, "AlbumCreateRequest"));

export const AlbumEditRequest = jsonDecoder(JsonDecoder.object<Requests.AlbumEdit>({
  id: JsonDecoder.string,
  album: JsonDecoder.object({
    name: JsonDecoder.optional(JsonDecoder.string),
    parent: OptionalOrNullDecoder(JsonDecoder.string, "parent"),
  }, "Album"),
}, "AlbumEditRequest"));

export const AlbumListRequest = jsonDecoder(JsonDecoder.object<Requests.AlbumList>({
  id: JsonDecoder.string,
  recursive: MappingDecoder(
    JsonDecoder.string,
    (val: string): boolean => val == "true",
    "recursive",
  ),
}, "AlbumListRequest"));

export const TagCreateRequest = jsonDecoder(JsonDecoder.object<Requests.TagCreate>({
  catalog: JsonDecoder.string,
  tag: JsonDecoder.object({
    name: JsonDecoder.string,
    parent: JsonDecoder.nullable(JsonDecoder.string),
  }, "Tag"),
}, "TagCreateRequest"));

export const TagEditRequest = jsonDecoder(JsonDecoder.object<Requests.TagEdit>({
  id: JsonDecoder.string,
  tag: JsonDecoder.object({
    name: JsonDecoder.optional(JsonDecoder.string),
    parent: OptionalOrNullDecoder(JsonDecoder.string, "parent"),
  }, "Tag"),
}, "TagEditRequest"));

export const TagFindRequest = jsonDecoder(JsonDecoder.object<Requests.TagFind>({
  catalog: JsonDecoder.string,
  names: JsonDecoder.array(JsonDecoder.string, "tag[]"),
}, "TagFindRequest"));

export const PersonCreateRequest = jsonDecoder(JsonDecoder.object<Requests.PersonCreate>({
  catalog: JsonDecoder.string,
  person: JsonDecoder.object({
    name: JsonDecoder.string,
  }, "Person"),
}, "PersonCreateRequest"));

export const PersonEditRequest = jsonDecoder(JsonDecoder.object<Requests.PersonEdit>({
  id: JsonDecoder.string,
  person: JsonDecoder.object({
    name: JsonDecoder.optional(JsonDecoder.string),
  }, "Person"),
}, "PersonEditRequest"));

export const MediaGetRequest = jsonDecoder(JsonDecoder.object<Requests.MediaGet>({
  id: JsonDecoder.string,
}, "MediaGetRequest"));

export const MediaSearchRequest = jsonDecoder(JsonDecoder.object<Requests.MediaSearch>({
  catalog: JsonDecoder.string,
  query: QueryDecoder,
}, "MediaSearchRequest"));

const LocationDecoder = JsonDecoder.object<Api.Location>({
  left: NumericDecoder,
  right: NumericDecoder,
  top: NumericDecoder,
  bottom: NumericDecoder,
}, "Location");

const SelectedTagDecoder = oneOf<Requests.SelectedTag>([
  JsonDecoder.string,
  JsonDecoder.array(JsonDecoder.string, "string[]"),
], "SelectedTag");

const SelectedPersonDecoder = oneOf<Requests.SelectedPerson>([
  JsonDecoder.string,
  JsonDecoder.object({
    person: JsonDecoder.string,
    location: JsonDecoder.optional(LocationDecoder),
  }, "Person"),
  JsonDecoder.object({
    name: JsonDecoder.string,
    location: JsonDecoder.optional(LocationDecoder),
  }, "Person"),
], "SelectedPerson");

const MetadataDecoder = JsonDecoder.object<Partial<ObjectModel.Metadata>>({
  filename: OptionalOrNullDecoder(JsonDecoder.string, "filename"),
  title: OptionalOrNullDecoder(JsonDecoder.string, "title"),
  description: OptionalOrNullDecoder(JsonDecoder.string, "description"),
  label: OptionalOrNullDecoder(JsonDecoder.string, "label"),
  category: OptionalOrNullDecoder(JsonDecoder.string, "category"),
  taken: OptionalOrNullDecoder(DateDecoder, "taken"),
  takenZone: OptionalOrNullDecoder(JsonDecoder.string, "takenZone"),
  longitude: OptionalOrNullDecoder(NumericDecoder, "longitude"),
  latitude: OptionalOrNullDecoder(NumericDecoder, "latitude"),
  altitude: OptionalOrNullDecoder(NumericDecoder, "altitude"),
  location: OptionalOrNullDecoder(JsonDecoder.string, "location"),
  city: OptionalOrNullDecoder(JsonDecoder.string, "city"),
  state: OptionalOrNullDecoder(JsonDecoder.string, "state"),
  country: OptionalOrNullDecoder(JsonDecoder.string, "country"),
  orientation: OptionalOrNullDecoder(
    JsonDecoder.enumeration<Orientation>(Orientation, "Orientation"),
    "orientation",
  ),
  make: OptionalOrNullDecoder(JsonDecoder.string, "make"),
  model: OptionalOrNullDecoder(JsonDecoder.string, "model"),
  lens: OptionalOrNullDecoder(JsonDecoder.string, "lens"),
  photographer: OptionalOrNullDecoder(JsonDecoder.string, "photographer"),
  aperture: OptionalOrNullDecoder(NumericDecoder, "aperture"),
  shutterSpeed: OptionalOrNullDecoder(JsonDecoder.string, "shutterSpeed"),
  iso: OptionalOrNullDecoder(NumericDecoder, "iso"),
  focalLength: OptionalOrNullDecoder(NumericDecoder, "focalLength"),
  rating: OptionalOrNullDecoder(NumericDecoder, "rating"),
}, "Metadata");

export async function MediaCreateRequest(
  data: unknown,
  files: Files | undefined,
): Promise<DeBlobbed<Requests.MediaCreate>> {
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

  let decoder = JsonDecoder.object<DeBlobbed<Requests.MediaCreate>>({
    file: JsonDecoder.constant(files.file),
    catalog: JsonDecoder.string,
    media: JsonDecoder.optional(MetadataDecoder),
    albums: JsonDecoder.optional(JsonDecoder.array(JsonDecoder.string, "album[]")),
    tags: JsonDecoder.optional(JsonDecoder.array(SelectedTagDecoder, "SelectedTag[]")),
    people: JsonDecoder.optional(JsonDecoder.array(SelectedPersonDecoder, "SelectedPerson[]")),
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

export async function MediaEditRequest(
  data: unknown,
  files: Files | undefined,
): Promise<DeBlobbed<Requests.MediaEdit>> {
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

  let decoder = JsonDecoder.object<DeBlobbed<Requests.MediaEdit>>({
    id: JsonDecoder.string,
    file: JsonDecoder.constant(files?.file),
    media: JsonDecoder.optional(MetadataDecoder),
    albums: JsonDecoder.optional(JsonDecoder.array(JsonDecoder.string, "album[]")),
    tags: JsonDecoder.optional(JsonDecoder.array(SelectedTagDecoder, "SelectedTag[]")),
    people: JsonDecoder.optional(JsonDecoder.array(SelectedPersonDecoder, "SelectedPerson[]")),
  }, "MediaEditRequest");

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

const RelationTypeDecoder = oneOf([
  JsonDecoder.isExactly(RelationType.Album),
  JsonDecoder.isExactly(RelationType.Tag),
  JsonDecoder.isExactly(RelationType.Person),
], "RelationType");

const MediaRelationChangeDecoder = oneOf<Requests.MediaRelations>([
  JsonDecoder.object<Requests.MediaRelationAdd>({
    operation: JsonDecoder.isExactly("add"),
    type: RelationTypeDecoder,
    media: JsonDecoder.array(JsonDecoder.string, "media[]"),
    items: JsonDecoder.array(JsonDecoder.string, "item[]"),
  }, "MediaRelationAdd"),
  JsonDecoder.object<Requests.MediaRelationDelete>({
    operation: JsonDecoder.isExactly("delete"),
    type: RelationTypeDecoder,
    media: JsonDecoder.array(JsonDecoder.string, "media[]"),
    items: JsonDecoder.array(JsonDecoder.string, "item[]"),
  }, "MediaRelationDelete"),
  JsonDecoder.object<Requests.MediaSetRelations>({
    operation: JsonDecoder.isExactly("setRelations"),
    type: RelationTypeDecoder,
    media: JsonDecoder.array(JsonDecoder.string, "media[]"),
    items: JsonDecoder.array(JsonDecoder.string, "item[]"),
  }, "MediaSetRelations"),
  JsonDecoder.object<Requests.RelationsSetMedia>({
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

const MediaPersonDecoder = JsonDecoder.object({
  media: JsonDecoder.string,
  person: JsonDecoder.string,
  location: JsonDecoder.optional(LocationDecoder),
}, "MediaPerson");

export const MediaPersonLocations = jsonDecoder(JsonDecoder.array(
  MediaPersonDecoder,
  "MediaPeople",
));

export const SearchSaveRequest = jsonDecoder(JsonDecoder.object<Requests.SavedSearchCreate>({
  catalog: JsonDecoder.string,
  search: JsonDecoder.object<Omit<ObjectModel.SavedSearch, "id">>({
    shared: JsonDecoder.boolean,
    query: QueryDecoder,
    name: JsonDecoder.string,
  }, "Search"),
}, "SavedSearch"));

export const SearchEditRequest = jsonDecoder(JsonDecoder.object<Requests.SavedSearchEdit>({
  id: JsonDecoder.string,
  search: JsonDecoder.object<Partial<Omit<ObjectModel.SavedSearch, "id">>>({
    shared: JsonDecoder.optional(JsonDecoder.boolean),
    query: JsonDecoder.optional(QueryDecoder),
    name: JsonDecoder.optional(JsonDecoder.string),
  }, "Search"),
}, "SavedSearch"));
