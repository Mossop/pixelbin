import { JsonDecoder } from "ts.data.json";
import moment from "moment";

import { DateDecoder, MapDecoder } from "../utils/decoders";
import { MapOf } from "../utils/maps";
import { L10nArgs, LocalizedProps, l10nAttributes } from "../l10n";
import { Metadata, MetadataDecoder } from "./metadata";
import { Draft } from "immer";

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

export const AlbumDecoder = JsonDecoder.object<Draft<Album>>(
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

export const TagDecoder = JsonDecoder.object<Draft<Tag>>(
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

export const PersonDecoder = JsonDecoder.object<Draft<Person>>(
  {
    id: JsonDecoder.string,
    fullname: JsonDecoder.string,
  },
  "Person"
);

export interface Catalog {
  readonly id: string;
  readonly root: string;
  readonly tags: MapOf<Tag>;
  readonly albums: MapOf<Album>;
}

export const CatalogDecoder = JsonDecoder.object<Draft<Catalog>>(
  {
    id: JsonDecoder.string,
    root: JsonDecoder.string,
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

export const UserDecoder = JsonDecoder.object<Draft<User>>(
  {
    email: JsonDecoder.string,
    fullname: JsonDecoder.string,
    hadCatalog: JsonDecoder.boolean,
    verified: JsonDecoder.boolean,
  },
  "User"
);

export interface UserState extends User {
  readonly catalogs: MapOf<Catalog>;
}

export const UserStateDecoder = JsonDecoder.object<Draft<UserState>>(
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

export const ServerStateDecoder = JsonDecoder.object<Draft<ServerState>>(
  {
    user: JsonDecoder.optional(UserStateDecoder),
  },
  "ServerState"
);

export interface UnprocessedMedia {
  readonly id: string;

  readonly tags: string[];
  readonly albums: string[];
  readonly people: string[];

  readonly metadata: Metadata;
}

export interface ProcessedMedia extends UnprocessedMedia {
  readonly processVersion: number;
  readonly uploaded: moment.Moment;
  readonly mimetype: string;
  readonly width: number;
  readonly height: number;
}

export type Media = UnprocessedMedia | ProcessedMedia;

export const UnprocessedMediaDecoder = JsonDecoder.object<Draft<UnprocessedMedia>>(
  {
    id: JsonDecoder.string,

    tags: JsonDecoder.array(JsonDecoder.string, "tag[]"),
    albums: JsonDecoder.array(JsonDecoder.string, "album[]"),
    people: JsonDecoder.array(JsonDecoder.string, "people[]"),

    metadata: MetadataDecoder,
  },
  "UnprocessedMedia"
);

export const ProcessedMediaDecoder = JsonDecoder.object<Draft<ProcessedMedia>>(
  {
    id: JsonDecoder.string,

    processVersion: JsonDecoder.number,
    uploaded: DateDecoder,
    mimetype: JsonDecoder.string,
    width: JsonDecoder.number,
    height: JsonDecoder.number,

    tags: JsonDecoder.array(JsonDecoder.string, "tag[]"),
    albums: JsonDecoder.array(JsonDecoder.string, "album[]"),
    people: JsonDecoder.array(JsonDecoder.string, "people[]"),

    metadata: MetadataDecoder,
  },
  "ProcessedMedia"
);

export function isProcessed(media: Media): media is ProcessedMedia {
  return "processVersion" in media && media.processVersion > 0;
}

export const MediaDecoder = JsonDecoder.oneOf<Media>([ProcessedMediaDecoder, UnprocessedMediaDecoder], "Media");
export const MediaArrayDecoder = JsonDecoder.array<Media>(MediaDecoder, "Media[]");
