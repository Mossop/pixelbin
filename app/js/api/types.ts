import { JsonDecoder } from "ts.data.json";
import moment from "moment";

import { Draft } from "../utils/immer";
import { DateDecoder, MapDecoder } from "../utils/decoders";
import { MapOf } from "../utils/maps";
import { L10nArgs, LocalizedProps, l10nAttributes } from "../l10n";
import { Metadata, MetadataDecoder } from "./metadata";

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

export interface AlbumData {
  catalog: string;
  id: string;
  stub?: string;
  name: string;
  parent?: string;
}

export const AlbumDecoder = JsonDecoder.object<AlbumData>(
  {
    catalog: JsonDecoder.string,
    id: JsonDecoder.string,
    stub: JsonDecoder.optional(JsonDecoder.string),
    name: JsonDecoder.string,
    parent: JsonDecoder.optional(JsonDecoder.string),
  },
  "AlbumState"
);

export interface TagData {
  catalog: string;
  id: string;
  name: string;
  parent: string | undefined;
}

export const TagDecoder = JsonDecoder.object<TagData>(
  {
    catalog: JsonDecoder.string,
    id: JsonDecoder.string,
    name: JsonDecoder.string,
    parent: JsonDecoder.optional(JsonDecoder.string),
  },
  "TagState"
);

export interface PersonData {
  catalog: string;
  id: string;
  fullname: string;
}

export const PersonDecoder = JsonDecoder.object<PersonData>(
  {
    catalog: JsonDecoder.string,
    id: JsonDecoder.string,
    fullname: JsonDecoder.string,
  },
  "PersonState"
);

export interface CatalogData {
  id: string;
  root: string;
  tags: MapOf<TagData>;
  albums: MapOf<AlbumData>;
  people: MapOf<PersonData>;
}

export const CatalogDecoder = JsonDecoder.object<CatalogData>(
  {
    id: JsonDecoder.string,
    root: JsonDecoder.string,
    tags: MapDecoder(TagDecoder, "TagState"),
    albums: MapDecoder(AlbumDecoder, "AlbumState"),
    people: MapDecoder(PersonDecoder, "PersonState"),
  },
  "CatalogState"
);

export interface UserInfoData {
  email: string;
  fullname: string;
  hadCatalog: boolean;
  verified: boolean;
}

export const UserInfoDecoder = JsonDecoder.object<UserInfoData>(
  {
    email: JsonDecoder.string,
    fullname: JsonDecoder.string,
    hadCatalog: JsonDecoder.boolean,
    verified: JsonDecoder.boolean,
  },
  "UserInfoState"
);

export interface UserData extends UserInfoData {
  catalogs: MapOf<CatalogData>;
}

export const UserDecoder = JsonDecoder.object<Draft<UserData>>(
  {
    email: JsonDecoder.string,
    fullname: JsonDecoder.string,
    hadCatalog: JsonDecoder.boolean,
    verified: JsonDecoder.boolean,
    catalogs: MapDecoder(CatalogDecoder, "Catalog"),
  },
  "UserState"
);

export interface ServerData {
  user?: UserData;
}

export const ServerStateDecoder = JsonDecoder.object<ServerData>(
  {
    user: JsonDecoder.optional(UserDecoder),
  },
  "ServerState"
);

export interface UnprocessedMediaData {
  id: string;

  tags: string[];
  albums: string[];
  people: string[];

  metadata: Metadata;
}

export interface ProcessedMediaData extends UnprocessedMediaData {
  processVersion: number;
  uploaded: moment.Moment;
  mimetype: string;
  width: number;
  height: number;
}

export type MediaData = UnprocessedMediaData | ProcessedMediaData;

export const UnprocessedMediaDecoder = JsonDecoder.object<UnprocessedMediaData>(
  {
    id: JsonDecoder.string,

    tags: JsonDecoder.array(JsonDecoder.string, "tag[]"),
    albums: JsonDecoder.array(JsonDecoder.string, "album[]"),
    people: JsonDecoder.array(JsonDecoder.string, "people[]"),

    metadata: MetadataDecoder,
  },
  "UnprocessedMediaState"
);

export const ProcessedMediaDecoder = JsonDecoder.object<ProcessedMediaData>(
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
  "ProcessedMediaState"
);

export function isProcessed(media: MediaData): media is ProcessedMediaData {
  return "processVersion" in media && media.processVersion > 0;
}

export const MediaDecoder = JsonDecoder.oneOf<MediaData>([ProcessedMediaDecoder, UnprocessedMediaDecoder], "Media");
export const MediaArrayDecoder = JsonDecoder.array<MediaData>(MediaDecoder, "Media[]");

export type CreateData<D> = Omit<D, "id">;
