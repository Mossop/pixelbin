import { JsonDecoder } from "ts.data.json";
import moment from "moment";

import { DateDecoder, MapDecoder, MappingDecoder } from "../utils/decoders";
import { Orientation } from "media-metadata/lib/metadata";
import { Mapped } from "../utils/maps";
import { L10nArgs, LocalizedProps, l10nAttributes } from "../l10n";

export interface APIError {
  status: number;
  statusText: string;
  code: string;
  args?: L10nArgs;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detail?: any;
}

const L10nArgsDecoder = JsonDecoder.dictionary<string | number>(
  JsonDecoder.oneOf<string | number>([
    JsonDecoder.number,
    JsonDecoder.string,
  ], "string | number"),
  "Args"
);

export function errorL10n(error: APIError): LocalizedProps {
  return l10nAttributes(`api-error-${error.code}`, error.args);
}

export async function decodeAPIError(response: Response): Promise<APIError> {
  let data = await response.json();

  let decoder = JsonDecoder.object<APIError>({
    status: JsonDecoder.constant(response.status),
    statusText: JsonDecoder.constant(response.statusText),
    code: JsonDecoder.string,
    args: JsonDecoder.optional(L10nArgsDecoder),
    detail: JsonDecoder.succeed,
  },
  "APIError");

  try {
    return await decoder.decodePromise(data);
  } catch (e) {
    let error: APIError = {
      status: 0,
      statusText: "Error parse failed",
      code: "error-parse-failed",
      args: {
        detail: String(e),
      }
    };
    return error;
  }
}

export interface Album {
  readonly id: string;
  readonly stub: string | undefined;
  readonly name: string;
  readonly parent: string | undefined;
}

export const AlbumDecoder = JsonDecoder.object<Album>(
  {
    id: JsonDecoder.string,
    stub: JsonDecoder.optional(JsonDecoder.string),
    name: JsonDecoder.string,
    parent: JsonDecoder.optional(JsonDecoder.string),
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
    parent: JsonDecoder.optional(JsonDecoder.string),
  },
  "Tag"
);

export interface Person {
  readonly id: string;
  readonly fullname: string;
}

export const PersonDecoder = JsonDecoder.object<Person>(
  {
    id: JsonDecoder.string,
    fullname: JsonDecoder.string,
  },
  "Person"
);

export interface Catalog {
  readonly id: string;
  readonly root: Album;
  readonly tags: Readonly<Mapped<Tag>>;
  readonly albums: Readonly<Mapped<Album>>;
}

type SerializedCatalog = Omit<Catalog, "root"> & { root: string };

export const CatalogDecoder = MappingDecoder(JsonDecoder.object<SerializedCatalog>(
  {
    id: JsonDecoder.string,
    root: JsonDecoder.string,
    tags: MapDecoder(TagDecoder, "Tag"),
    albums: MapDecoder(AlbumDecoder, "Album"),
  },
  "Catalog"
), (source: SerializedCatalog): Catalog => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (source.albums[source.root]) {
    return Object.assign({}, source, { root: source.albums[source.root] });
  } else {
    throw new Error("Missing root album.");
  }
}, "Catalog");

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
    user: JsonDecoder.optional(UserStateDecoder),
  },
  "ServerState"
);

export interface UnprocessedMedia {
  readonly id: string;
  readonly catalog?: string;

  readonly tags: string[];
  readonly albums: string[];
  readonly people: string[];

  readonly title?: string;
  readonly taken?: moment.Moment;
  readonly longitude?: number;
  readonly latitude?: number;

  readonly orientation?: Orientation;
}

export interface ProcessedMedia extends UnprocessedMedia {
  readonly processVersion: number;
  readonly filename?: string;

  readonly uploaded: moment.Moment;
  readonly mimetype: string;
  readonly width: number;
  readonly height: number;
  readonly orientation: Orientation;
}

export type Media = UnprocessedMedia | ProcessedMedia;

export const UnprocessedMediaDecoder = JsonDecoder.object<UnprocessedMedia>(
  {
    id: JsonDecoder.string,

    tags: JsonDecoder.array(JsonDecoder.string, "tag[]"),
    albums: JsonDecoder.array(JsonDecoder.string, "album[]"),
    people: JsonDecoder.array(JsonDecoder.string, "people[]"),

    title: JsonDecoder.optional(JsonDecoder.string),
    taken: JsonDecoder.optional(DateDecoder),
    longitude: JsonDecoder.optional(JsonDecoder.number),
    latitude: JsonDecoder.optional(JsonDecoder.number),
  },
  "UnprocessedMedia"
);

export const ProcessedMediaDecoder = JsonDecoder.object<ProcessedMedia>(
  {
    id: JsonDecoder.string,
    processVersion: JsonDecoder.number,
    filename: JsonDecoder.optional(JsonDecoder.string),

    tags: JsonDecoder.array(JsonDecoder.string, "tag[]"),
    albums: JsonDecoder.array(JsonDecoder.string, "album[]"),
    people: JsonDecoder.array(JsonDecoder.string, "people[]"),

    title: JsonDecoder.optional(JsonDecoder.string),
    taken: JsonDecoder.optional(DateDecoder),
    longitude: JsonDecoder.optional(JsonDecoder.number),
    latitude: JsonDecoder.optional(JsonDecoder.number),

    uploaded: DateDecoder,
    mimetype: JsonDecoder.string,
    width: JsonDecoder.number,
    height: JsonDecoder.number,
    orientation: JsonDecoder.number,
  },
  "ProcessedMedia"
);

export function isProcessed(media: Media): media is ProcessedMedia {
  // @ts-ignore
  console.log("Checking:", media, "processVersion" in media, media.processVersion, media.processVersion > 0);
  return "processVersion" in media && media.processVersion > 0;
}

export const MediaDecoder = JsonDecoder.oneOf<Media>([ProcessedMediaDecoder, UnprocessedMediaDecoder], "Media");
export const MediaArrayDecoder = JsonDecoder.array<Media>(MediaDecoder, "Media[]");
