import { JsonDecoder } from "ts.data.json";

import type { Api } from "../../model";
import { Orientation } from "../../model";
import { DateDecoder, EnumDecoder, oneOf, QueryDecoder } from "../../utils";

export const PersonDecoder = JsonDecoder.object<Api.Person>(
  {
    id: JsonDecoder.string,
    catalog: JsonDecoder.string,
    name: JsonDecoder.string,
  },
  "Person",
);

const LocationDecoder = JsonDecoder.object({
  left: JsonDecoder.number,
  right: JsonDecoder.number,
  top: JsonDecoder.number,
  bottom: JsonDecoder.number,
}, "Location");

export const MediaAlbumDecoder = JsonDecoder.object<Api.MediaAlbum>(
  {
    album: JsonDecoder.string,
  },
  "MediaAlbum",
);

export const MediaTagDecoder = JsonDecoder.object<Api.MediaTag>(
  {
    tag: JsonDecoder.string,
  },
  "MediaTag",
);

export const MediaPersonDecoder = JsonDecoder.object<Api.MediaPerson>(
  {
    person: JsonDecoder.string,
    location: JsonDecoder.nullable(LocationDecoder),
  },
  "MediaPerson",
);

export const TagDecoder = JsonDecoder.object<Api.Tag>(
  {
    id: JsonDecoder.string,
    catalog: JsonDecoder.string,
    parent: JsonDecoder.nullable(JsonDecoder.string),
    name: JsonDecoder.string,
  },
  "Tag",
);

export const AlbumDecoder = JsonDecoder.object<Api.Album>(
  {
    id: JsonDecoder.string,
    catalog: JsonDecoder.string,
    name: JsonDecoder.string,
    parent: JsonDecoder.nullable(JsonDecoder.string),
  },
  "Album",
);

export const CatalogDecoder = JsonDecoder.object<Api.Catalog>(
  {
    id: JsonDecoder.string,
    storage: JsonDecoder.string,
    name: JsonDecoder.string,
  },
  "Catalog",
);

export const SavedSearchDecoder = JsonDecoder.object<Api.SavedSearch>(
  {
    id: JsonDecoder.string,
    catalog: JsonDecoder.string,
    name: JsonDecoder.string,
    shared: JsonDecoder.boolean,
    query: QueryDecoder,
  },
  "SavedSearch",
);

export const StorageTestResultDecoder = JsonDecoder.object<Api.StorageTestResult>(
  {
    result: EnumDecoder(JsonDecoder.string, "AWSResult"),
    message: JsonDecoder.nullable(JsonDecoder.string),
  },
  "StorageTestResult",
);

export const StorageDecoder = JsonDecoder.object<Api.Storage>(
  {
    id: JsonDecoder.string,
    name: JsonDecoder.string,
    bucket: JsonDecoder.string,
    region: JsonDecoder.string,
    path: JsonDecoder.nullable(JsonDecoder.string),
    endpoint: JsonDecoder.nullable(JsonDecoder.string),
    publicUrl: JsonDecoder.nullable(JsonDecoder.string),
  },
  "Storage",
);

export const UserDecoder = JsonDecoder.object<Api.User>(
  {
    email: JsonDecoder.string,
    fullname: JsonDecoder.string,
    administrator: JsonDecoder.boolean,
    created: DateDecoder,
    lastLogin: DateDecoder,
    verified: JsonDecoder.boolean,
    storage: JsonDecoder.array(StorageDecoder, "Storage[]"),
    catalogs: JsonDecoder.array(CatalogDecoder, "Catalog[]"),
    people: JsonDecoder.array(PersonDecoder, "Person[]"),
    tags: JsonDecoder.array(TagDecoder, "Tag[]"),
    albums: JsonDecoder.array(AlbumDecoder, "Album[]"),
    searches: JsonDecoder.array(SavedSearchDecoder, "SavedSearch[]"),
  },
  "User",
);

export const StateDecoder = JsonDecoder.object<Api.State>(
  {
    user: JsonDecoder.nullable(UserDecoder),
    apiHost: JsonDecoder.nullable(JsonDecoder.string),
  },
  "State",
);

const AlternateDecoder = JsonDecoder.object<Api.Alternate>({
  id: JsonDecoder.string,
  url: JsonDecoder.string,
  height: JsonDecoder.number,
  width: JsonDecoder.number,
  fileSize: JsonDecoder.number,
  mimetype: JsonDecoder.string,
  duration: JsonDecoder.nullable(JsonDecoder.number),
  bitRate: JsonDecoder.nullable(JsonDecoder.number),
  frameRate: JsonDecoder.nullable(JsonDecoder.number),
}, "Alternate");

const MediaFileDecoder = JsonDecoder.object<Api.MediaFile>({
  id: JsonDecoder.string,
  originalUrl: JsonDecoder.string,
  height: JsonDecoder.number,
  width: JsonDecoder.number,
  fileSize: JsonDecoder.number,
  mimetype: JsonDecoder.string,
  uploaded: DateDecoder,
  duration: JsonDecoder.nullable(JsonDecoder.number),
  bitRate: JsonDecoder.nullable(JsonDecoder.number),
  frameRate: JsonDecoder.nullable(JsonDecoder.number),
  posters: JsonDecoder.array(AlternateDecoder, "thumbnail[]"),
  thumbnails: JsonDecoder.array(AlternateDecoder, "thumbnail[]"),
  alternatives: JsonDecoder.array(AlternateDecoder, "alternative[]"),
}, "MediaFile");

export const MediaDecoder = JsonDecoder.object<Api.Media>({
  id: JsonDecoder.string,
  catalog: JsonDecoder.string,
  created: DateDecoder,
  updated: DateDecoder,

  file: JsonDecoder.nullable(MediaFileDecoder),

  filename: JsonDecoder.nullable(JsonDecoder.string),
  title: JsonDecoder.nullable(JsonDecoder.string),
  description: JsonDecoder.nullable(JsonDecoder.string),
  category: JsonDecoder.nullable(JsonDecoder.string),
  label: JsonDecoder.nullable(JsonDecoder.string),
  taken: JsonDecoder.nullable(DateDecoder),
  takenZone: JsonDecoder.nullable(JsonDecoder.string),
  longitude: JsonDecoder.nullable(JsonDecoder.number),
  latitude: JsonDecoder.nullable(JsonDecoder.number),
  altitude: JsonDecoder.nullable(JsonDecoder.number),
  location: JsonDecoder.nullable(JsonDecoder.string),
  city: JsonDecoder.nullable(JsonDecoder.string),
  state: JsonDecoder.nullable(JsonDecoder.string),
  country: JsonDecoder.nullable(JsonDecoder.string),
  orientation: JsonDecoder.nullable(
    JsonDecoder.enumeration<Orientation>(Orientation, "Orientation"),
  ),
  make: JsonDecoder.nullable(JsonDecoder.string),
  model: JsonDecoder.nullable(JsonDecoder.string),
  lens: JsonDecoder.nullable(JsonDecoder.string),
  photographer: JsonDecoder.nullable(JsonDecoder.string),
  aperture: JsonDecoder.nullable(JsonDecoder.number),
  shutterSpeed: JsonDecoder.nullable(JsonDecoder.string),
  iso: JsonDecoder.nullable(JsonDecoder.number),
  focalLength: JsonDecoder.nullable(JsonDecoder.number),
  rating: JsonDecoder.nullable(JsonDecoder.number),

  albums: JsonDecoder.array(MediaAlbumDecoder, "MediaAlbum[]"),
  tags: JsonDecoder.array(MediaTagDecoder, "MediaTag[]"),
  people: JsonDecoder.array(MediaPersonDecoder, "MediaPerson[]"),
}, "Media");

export const MediaArrayDecoder = JsonDecoder.array(MediaDecoder, "Media[]");

export const MaybeMediaArrayDecoder = JsonDecoder.array(
  oneOf([
    MediaDecoder,
    JsonDecoder.constant(null),
  ], "Media | null"),
  "(Media | null)[]",
);

export const ErrorDataDecoder = JsonDecoder.object<Api.ErrorData>({
  code: EnumDecoder(JsonDecoder.string, "ErrorCode"),
  data: JsonDecoder.optional(JsonDecoder.dictionary(JsonDecoder.string, "ErrorData")),
}, "ErrorData");
