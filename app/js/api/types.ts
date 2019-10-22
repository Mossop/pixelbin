import { JsonDecoder } from "ts.data.json";
import moment from "moment";

import { OptionalDecoder, DateDecoder, MapDecoder, MappingDecoder } from "../utils/decoders";
import { nameSorted } from "../utils/sort";
import { Orientation } from "media-metadata/lib/metadata";
import { Mapped } from "../utils/maps";
import { L10nArgs, LocalizedProps, l10nAttributes } from "../l10n";

export interface APIError {
  status: number;
  statusText: string;
  code: string;
  args?: L10nArgs;
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
    args: OptionalDecoder(L10nArgsDecoder, "Args?"),
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
    user: OptionalDecoder(UserStateDecoder, "User"),
  },
  "ServerState"
);

export interface Media {
  readonly id: string;
  readonly processed: boolean;
  readonly orientation: Orientation;
  readonly title?: string;
  readonly filename?: string;

  readonly longitude?: number;
  readonly latitude?: number;
  readonly taken?: moment.Moment;

  readonly tags: string[][];
  readonly people: string[];

  readonly mimetype: string;
  readonly width: number;
  readonly height: number;
}

export const MediaDecoder = JsonDecoder.object<Media>(
  {
    id: JsonDecoder.string,
    processed: JsonDecoder.boolean,
    orientation: JsonDecoder.number,
    title: OptionalDecoder(JsonDecoder.string, "title"),
    filename: OptionalDecoder(JsonDecoder.string, "title"),

    longitude: OptionalDecoder(JsonDecoder.number, "longitude"),
    latitude: OptionalDecoder(JsonDecoder.number, "latitude"),
    taken: OptionalDecoder(DateDecoder, "taken"),

    tags: JsonDecoder.array(JsonDecoder.array(JsonDecoder.string, "tag"), "tag[]"),
    people: JsonDecoder.array(JsonDecoder.string, "people[]"),

    mimetype: JsonDecoder.string,
    width: JsonDecoder.number,
    height: JsonDecoder.number,
  },
  "Media"
);

export const MediaArrayDecoder = JsonDecoder.array<Media>(MediaDecoder, "Media[]");

export interface UploadMetadata {
  tags: string[][];
  people: string[];
  orientation: Orientation;
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

export function albumChildren(catalog: Catalog, item?: Album): Album[] {
  let parent = item ? item.id : undefined;
  return nameSorted(Object.values(catalog.albums).filter((a: Album) => a.parent == parent));
}
