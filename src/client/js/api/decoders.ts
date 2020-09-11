import { JsonDecoder, Result } from "ts.data.json";

import { Api } from "../../../model";
import { DateDecoder } from "../../../utils";

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

export const MediaPersonDecoder = JsonDecoder.object<Api.MediaPerson>(
  {
    id: JsonDecoder.string,
    catalog: JsonDecoder.string,
    name: JsonDecoder.string,
    location: JsonDecoder.nullable(LocationDecoder),
  },
  "Person",
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
    name: JsonDecoder.string,
    storage: JsonDecoder.string,
  },
  "Catalog",
);

export const StorageDecoder = JsonDecoder.object<Api.Storage>(
  {
    id: JsonDecoder.string,
    name: JsonDecoder.string,
    bucket: JsonDecoder.string,
    region: JsonDecoder.nullable(JsonDecoder.string),
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
    created: DateDecoder,
    verified: JsonDecoder.boolean,
    storage: JsonDecoder.array(StorageDecoder, "Storage[]"),
    catalogs: JsonDecoder.array(CatalogDecoder, "Catalog[]"),
    people: JsonDecoder.array(PersonDecoder, "Person[]"),
    tags: JsonDecoder.array(TagDecoder, "Tag[]"),
    albums: JsonDecoder.array(AlbumDecoder, "Album[]"),
  },
  "User",
);

export const StateDecoder = JsonDecoder.object<Api.State>(
  {
    user: JsonDecoder.nullable(UserDecoder),
  },
  "State",
);

export const UnprocessedMediaProperties = {
  id: JsonDecoder.string,
  created: DateDecoder,
  filename: JsonDecoder.nullable(JsonDecoder.string),
  title: JsonDecoder.nullable(JsonDecoder.string),
  taken: JsonDecoder.nullable(DateDecoder),
  timeZone: JsonDecoder.nullable(JsonDecoder.string),
  longitude: JsonDecoder.nullable(JsonDecoder.number),
  latitude: JsonDecoder.nullable(JsonDecoder.number),
  altitude: JsonDecoder.nullable(JsonDecoder.number),
  location: JsonDecoder.nullable(JsonDecoder.string),
  city: JsonDecoder.nullable(JsonDecoder.string),
  state: JsonDecoder.nullable(JsonDecoder.string),
  country: JsonDecoder.nullable(JsonDecoder.string),
  orientation: JsonDecoder.nullable(JsonDecoder.number),
  make: JsonDecoder.nullable(JsonDecoder.string),
  model: JsonDecoder.nullable(JsonDecoder.string),
  lens: JsonDecoder.nullable(JsonDecoder.string),
  photographer: JsonDecoder.nullable(JsonDecoder.string),
  aperture: JsonDecoder.nullable(JsonDecoder.number),
  exposure: JsonDecoder.nullable(JsonDecoder.number),
  iso: JsonDecoder.nullable(JsonDecoder.number),
  focalLength: JsonDecoder.nullable(JsonDecoder.number),
  rating: JsonDecoder.nullable(JsonDecoder.number),

  albums: JsonDecoder.array(AlbumDecoder, "album[]"),
  tags: JsonDecoder.array(TagDecoder, "tag[]"),
  people: JsonDecoder.array(MediaPersonDecoder, "person[]"),
};

export const UnprocessedMediaDecoder = JsonDecoder.object<Api.UnprocessedMedia>(
  UnprocessedMediaProperties,
  "UnprocessedMedia",
);

export const ProcessedMediaDecoder = JsonDecoder.object<Api.ProcessedMedia>({
  ...UnprocessedMediaProperties,
  height: JsonDecoder.number,
  width: JsonDecoder.number,
  fileSize: JsonDecoder.number,
  mimetype: JsonDecoder.string,
  uploaded: DateDecoder,
  duration: JsonDecoder.nullable(JsonDecoder.number),
  bitRate: JsonDecoder.nullable(JsonDecoder.number),
  frameRate: JsonDecoder.nullable(JsonDecoder.number),
}, "ProcessedMedia");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MediaDecoder = new JsonDecoder.Decoder<Api.Media>((json: any): Result<Api.Media> => {
  if ("uploaded" in json && json.uploaded) {
    return ProcessedMediaDecoder.decode(json);
  }
  return UnprocessedMediaDecoder.decode(json);
});

export const MediaArrayDecoder = JsonDecoder.array(MediaDecoder, "Media[]");

export const MaybeMediaArrayDecoder = JsonDecoder.array(
  JsonDecoder.oneOf([
    MediaDecoder,
    JsonDecoder.constant(null),
  ], "Media | null"),
  "(Media | null)[]",
);

export const ErrorDataDecoder = JsonDecoder.object<Api.ErrorData>({
  code: JsonDecoder.string as JsonDecoder.Decoder<Api.ErrorCode>,
  data: JsonDecoder.optional(JsonDecoder.dictionary(JsonDecoder.string, "ErrorData")),
}, "ErrorData");
