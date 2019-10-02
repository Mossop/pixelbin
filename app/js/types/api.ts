import { JsonDecoder, Ok, ok, err, Result } from "ts.data.json";
import moment from "moment";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decode<A>(decoder: JsonDecoder.Decoder<A>, data: any): A {
  let result = decoder.decode(data);
  if (result instanceof Ok) {
    return result.value;
  }
  throw new Error(result.error);
}

function OptionalDecoder<A>(decoder: JsonDecoder.Decoder<A>, name: string): JsonDecoder.Decoder<undefined | A> {
  return JsonDecoder.oneOf([JsonDecoder.isNull(undefined), JsonDecoder.isUndefined(undefined), decoder], `${name}?`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DateDecoder = new JsonDecoder.Decoder<moment.Moment>((json: any): Result<moment.Moment> => {
  if (typeof json === "string") {
    try {
      return ok<moment.Moment>(moment(json, moment.ISO_8601));
    } catch (e) {
      return err<moment.Moment>(`'${json}' could not be parsed as ISO 8601: ${e}`);
    }
  }
  return err<moment.Moment>(`'${json}' is not a string.`);
});

export interface Album {
  id: string;
  stub: string;
  name: string;
  private: boolean;
  children: Album[];
}

export const AlbumDecoder = JsonDecoder.object<Album>(
  {
    id: JsonDecoder.string,
    stub: JsonDecoder.string,
    name: JsonDecoder.string,
    private: JsonDecoder.boolean,
    children: JsonDecoder.array<Album>(JsonDecoder.lazy<Album>(() => AlbumDecoder), "Album[]"),
  },
  "Album"
);

export interface Tag {
  name: string;
  path: string;
  children: Tag[];
}

export const TagDecoder = JsonDecoder.object<Tag>(
  {
    name: JsonDecoder.string,
    path: JsonDecoder.string,
    children: JsonDecoder.array<Tag>(JsonDecoder.lazy<Tag>(() => TagDecoder), "Tag[]"),
  },
  "Tag"
);

export interface Catalog {
  id: string;
  stub: string;
  name: string;
  editable: boolean;
  tags: Tag[];
  albums: Album[];
}

export const CatalogDecoder = JsonDecoder.object<Catalog>(
  {
    id: JsonDecoder.string,
    stub: JsonDecoder.string,
    name: JsonDecoder.string,
    editable: JsonDecoder.boolean,
    tags: JsonDecoder.array(TagDecoder, "Tag[]"),
    albums: JsonDecoder.array(AlbumDecoder, "Album[]"),
  },
  "Catalog"
);

export interface User {
  email: string;
  fullname: string;
  catalogs: Catalog[];
}

export const UserDecoder = JsonDecoder.object<User>(
  {
    email: JsonDecoder.string,
    fullname: JsonDecoder.string,
    catalogs: JsonDecoder.array(CatalogDecoder, "Catalog[]"),
  },
  "User"
);

export interface ServerState {
  user?: User;
}

export const ServerStateDecoder = JsonDecoder.object<ServerState>(
  {
    user: OptionalDecoder(UserDecoder, "User"),
  },
  "ServerState"
);

export interface Media {
  id: number;
  processed: boolean;

  tags: string[];
  longitude?: number;
  latitude?: number;
  taken: moment.Moment;

  mimetype: string;
  width: number;
  height: number;
}

export const MediaDecoder = JsonDecoder.object<Media>(
  {
    id: JsonDecoder.number,
    processed: JsonDecoder.boolean,

    tags: JsonDecoder.array<string>(JsonDecoder.string, "path[]"),
    longitude: OptionalDecoder(JsonDecoder.number, "longitude"),
    latitude: OptionalDecoder(JsonDecoder.number, "latitude"),
    taken: DateDecoder,

    mimetype: JsonDecoder.string,
    width: JsonDecoder.number,
    height: JsonDecoder.number,
  },
  "Media"
);

export const MediaArrayDecoder = JsonDecoder.array<Media>(MediaDecoder, "Media[]");

export interface UploadMetadata {
  tags: string;
  taken: moment.Moment;
  latitude?: number;
  longitude?: number;
}

export interface UploadResponse {
  tags: Tag[];
  media: Media;
}

export const UploadResponseDecoder = JsonDecoder.object<UploadResponse>(
  {
    tags: JsonDecoder.array<Tag>(TagDecoder, "Tag[]"),
    media: MediaDecoder,
  },
  "UploadResponseDecoder"
);
