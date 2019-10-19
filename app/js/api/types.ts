import { JsonDecoder } from "ts.data.json";
import moment from "moment";

import { OptionalDecoder, DateDecoder, MapDecoder, Mapped } from "../utils/decoders";

export interface Album {
  readonly id: string;
  readonly stub: string | undefined;
  readonly name: string;
  readonly parent: string | undefined;
}

export const AlbumDecoder = JsonDecoder.object<Album>(
  {
    id: JsonDecoder.string,
    stub: OptionalDecoder(JsonDecoder.string, "stub?"),
    name: JsonDecoder.string,
    parent: OptionalDecoder(JsonDecoder.string, "parent?"),
  },
  "Album"
);

export interface Tag {
  readonly id: string;
  readonly name: string;
  readonly parent: string | undefined;
}

export const TagDecoder = JsonDecoder.object<Tag>(
  {
    id: JsonDecoder.string,
    name: JsonDecoder.string,
    parent: OptionalDecoder(JsonDecoder.string, "parent?"),
  },
  "Tag"
);

export interface Catalog {
  readonly id: string;
  readonly name: string;
  readonly tags: Readonly<Mapped<Tag>>;
  readonly albums: Readonly<Mapped<Album>>;
}

export const CatalogDecoder = JsonDecoder.object<Catalog>(
  {
    id: JsonDecoder.string,
    name: JsonDecoder.string,
    tags: MapDecoder(TagDecoder, "Tag"),
    albums: MapDecoder(AlbumDecoder, "Album"),
  },
  "Catalog"
);

export interface User {
  readonly email: string;
  readonly fullname: string;
  readonly hadCatalog: boolean;
  readonly verified: boolean;
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
  readonly catalogs: Readonly<Mapped<Catalog>>;
}

export const UserStateDecoder = JsonDecoder.object<UserState>(
  {
    email: JsonDecoder.string,
    fullname: JsonDecoder.string,
    hadCatalog: JsonDecoder.boolean,
    verified: JsonDecoder.boolean,
    catalogs: MapDecoder(CatalogDecoder, "Catalog"),
  },
  "UserState"
);

export interface ServerState {
  readonly user?: UserState;
}

export const ServerStateDecoder = JsonDecoder.object<ServerState>(
  {
    user: OptionalDecoder(UserStateDecoder, "User"),
  },
  "ServerState"
);

export interface Media {
  readonly id: number;
  readonly processed: boolean;

  readonly tags: string[];
  readonly longitude?: number;
  readonly latitude?: number;
  readonly taken: moment.Moment;

  readonly mimetype: string;
  readonly width: number;
  readonly height: number;
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
