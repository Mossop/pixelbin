import { JsonDecoder } from "ts.data.json";
import moment from "moment";

import { OptionalDecoder, SortedDecoder, DateDecoder } from "../utils/decoders";

export interface Album {
  id: string;
  stub: string;
  name: string;
  private: boolean;
  parent: string | undefined;
}

export const AlbumDecoder = JsonDecoder.object<Album>(
  {
    id: JsonDecoder.string,
    stub: JsonDecoder.string,
    name: JsonDecoder.string,
    private: JsonDecoder.boolean,
    parent: OptionalDecoder(JsonDecoder.string, "parent?"),
  },
  "Album"
);

export interface Tag {
  name: string;
  path: string;
  parent: string | undefined;
}

export const TagDecoder = JsonDecoder.object<Tag>(
  {
    name: JsonDecoder.string,
    path: JsonDecoder.string,
    parent: OptionalDecoder(JsonDecoder.string, "parent?"),
  },
  "Tag"
);

export interface Catalog {
  id: string;
  name: string;
  tags: Tag[];
  albums: Album[];
}

export const CatalogDecoder = JsonDecoder.object<Catalog>(
  {
    id: JsonDecoder.string,
    name: JsonDecoder.string,
    tags: JsonDecoder.array<Tag>(TagDecoder, "Tag[]"),
    albums: JsonDecoder.array<Album>(AlbumDecoder, "Album[]"),
  },
  "Catalog"
);

export interface User {
  email: string;
  fullname: string;
  hadCatalog: boolean;
  verified: boolean;
}

export const UserDecoder = JsonDecoder.object<User>(
  {
    email: JsonDecoder.string,
    fullname: JsonDecoder.string,
    hadCatalog: JsonDecoder.boolean,
    verified: JsonDecoder.boolean,
  },
  "User"
);

export interface UserState extends User {
  catalogs: Catalog[];
}

export const UserStateDecoder = JsonDecoder.object<UserState>(
  {
    email: JsonDecoder.string,
    fullname: JsonDecoder.string,
    hadCatalog: JsonDecoder.boolean,
    verified: JsonDecoder.boolean,
    catalogs: SortedDecoder(JsonDecoder.array(CatalogDecoder, "Catalog[]"),
      (a: Catalog, b: Catalog) => a.name.localeCompare(b.name), "Catalog[]"),
  },
  "UserState"
);

export interface ServerState {
  user?: UserState;
}

export const ServerStateDecoder = JsonDecoder.object<ServerState>(
  {
    user: OptionalDecoder(UserStateDecoder, "User"),
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
