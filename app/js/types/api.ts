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

function MapDecoder<A, B>(decoder: JsonDecoder.Decoder<A>, mapper: (data: A) => B, name: string): JsonDecoder.Decoder<B> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new JsonDecoder.Decoder<B>((json: any): Result<B> => {
    let result = decoder.decode(json);
    if (result instanceof Ok) {
      try {
        return ok<B>(mapper(result.value));
      } catch (e) {
        return err<B>(`Error decoding ${name}: ${e}`);
      }
    } else {
      return err<B>(result.error);
    }
  });
}

function OptionalDecoder<A>(decoder: JsonDecoder.Decoder<A>, name: string): JsonDecoder.Decoder<undefined | A> {
  return JsonDecoder.oneOf([JsonDecoder.isNull(undefined), JsonDecoder.isUndefined(undefined), decoder], `${name}?`);
}

function SortedDecoder<A>(decoder: JsonDecoder.Decoder<A[]>, compare: undefined | ((a: A, b: A) => number), name: string): JsonDecoder.Decoder<A[]> {
  return MapDecoder(decoder, (arr: A[]) => {
    arr.sort(compare);
    return arr;
  }, name);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DateDecoder = MapDecoder(JsonDecoder.string, (str: string) => moment(str, moment.ISO_8601), "Moment");

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
    children: SortedDecoder(JsonDecoder.array<Album>(JsonDecoder.lazy<Album>(() => AlbumDecoder), "Album[]"),
      (a: Album, b: Album) => a.name.localeCompare(b.name), "Album[]"),
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
    children: SortedDecoder(JsonDecoder.array<Tag>(JsonDecoder.lazy<Tag>(() => TagDecoder), "Tag[]"),
      (a: Tag, b: Tag) => a.name.localeCompare(b.name), "Tag[]"),
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
    tags: SortedDecoder(JsonDecoder.array(TagDecoder, "Tag[]"),
      (a: Tag, b: Tag) => a.name.localeCompare(b.name), "Tag[]"),
    albums: SortedDecoder(JsonDecoder.array<Album>(AlbumDecoder, "Album[]"),
      (a: Album, b: Album) => a.name.localeCompare(b.name), "Album[]"),
  },
  "Catalog"
);

export interface User {
  email: string;
  fullname: string;
  hadCatalog: boolean;
  catalogs: Catalog[];
}

export const UserDecoder = JsonDecoder.object<User>(
  {
    email: JsonDecoder.string,
    fullname: JsonDecoder.string,
    hadCatalog: JsonDecoder.boolean,
    catalogs: SortedDecoder(JsonDecoder.array(CatalogDecoder, "Catalog[]"),
      (a: Catalog, b: Catalog) => a.name.localeCompare(b.name), "Catalog[]"),
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
