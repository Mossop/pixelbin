import type { Draft } from "immer";
import type { Zone } from "luxon";
import { IANAZone } from "luxon";
import MIMEType from "whatwg-mimetype";

import type { Api, ObjectModel } from "../../model";
import type { Overwrite, DateTime } from "../../utils";
import { hasTimezone, isoDateTime } from "../../utils";
import Services from "../services";
import type { ReadonlyMapOf } from "../utils/maps";
import { intoMap } from "../utils/maps";
import type { Reference, Person } from "./highlevel";
import { Album, Catalog, Tag } from "./highlevel";

const EXTENSION_MAP = {
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
};

export type UserState = Overwrite<Readonly<ObjectModel.User>, {
  readonly created: string;
  readonly lastLogin: string | null;
  readonly storage: ReadonlyMapOf<StorageState>;
  readonly catalogs: ReadonlyMapOf<CatalogState>;
}>;

export type StorageState = Api.Storage;

export type CatalogState = Readonly<ObjectModel.Catalog> & {
  readonly storage: string;
  readonly tags: ReadonlyMapOf<TagState>;
  readonly albums: ReadonlyMapOf<AlbumState>;
  readonly people: ReadonlyMapOf<PersonState>;
  readonly searches: ReadonlyMapOf<SavedSearchState>;
};

export type PersonState = Readonly<ObjectModel.Person> & {
  readonly catalog: Reference<Catalog>;
};

export type TagState = Overwrite<Readonly<ObjectModel.Tag>, {
  readonly parent: Reference<Tag> | null;
  readonly catalog: Reference<Catalog>;
}>;

export type AlbumState = Overwrite<Readonly<ObjectModel.Album>, {
  readonly parent: Reference<Album> | null;
  readonly catalog: Reference<Catalog>;
}>;

export type SavedSearchState = Readonly<ObjectModel.SavedSearch> & {
  readonly catalog: Reference<Catalog>;
};

export type MediaAlbumState = ObjectModel.MediaAlbum & {
  readonly album: Reference<Album>;
};

export type MediaTagState = ObjectModel.MediaTag & {
  readonly tag: Reference<Tag>;
};

export type MediaPersonState = ObjectModel.MediaPerson & {
  readonly person: Reference<Person>;
};

export interface MediaRelations {
  readonly albums: MediaAlbumState[];
  readonly tags: MediaTagState[];
  readonly people: MediaPersonState[];
}

export interface Thumbnail {
  mimetype: string;
  size: number;
  url: string;
}

export interface Encoding {
  mimetype: string;
  url: string;
}

export type MediaFileState = Api.MediaFile & {
  url: string;
  thumbnails: Thumbnail[];
  encodings: Encoding[];
  videoEncodings: Encoding[];
};

export type UnprocessedMediaState = Overwrite<Api.Media, {
  catalog: Reference<Catalog>;
  file: null;
}>;

export type ProcessedMediaState = Overwrite<Api.Media, {
  catalog: Reference<Catalog>;
  file: MediaFileState;
}>;

export type MediaState = UnprocessedMediaState | ProcessedMediaState;

export type SharedMediaWithMetadataState = Overwrite<Api.SharedMediaWithMetadata, {
  file: MediaFileState;
}>;

export type BaseMediaState = MediaState | SharedMediaWithMetadataState;

export type SharedSearchResults = Overwrite<Api.SharedSearchResults, {
  media: SharedMediaWithMetadataState[];
}>;

export function isProcessed<T extends BaseMediaState>(
  media: T,
): media is Exclude<T, UnprocessedMediaState> {
  return !!media.file;
}

export interface Thumbnails {
  readonly encodings: readonly string[];
  readonly sizes: readonly number[];
}

export interface ServerState {
  readonly user: UserState | null;
  readonly thumbnails: Thumbnails;
  readonly encodings: readonly string[];
  readonly videoEncodings: readonly string[];
}

function nameForType(mimetype: string, filename?: string | null): string {
  let parsed = new MIMEType(mimetype);

  if (filename) {
    filename = filename.replace(/\..*$/, "");
  } else {
    filename = parsed.type;
  }

  if (parsed.essence in EXTENSION_MAP) {
    filename += `.${EXTENSION_MAP[parsed.essence]}`;
  }

  return filename;
}

function encodingUrl(mimetype: string, filename: string | null): string {
  let parsed = new MIMEType(mimetype);

  return `${parsed.type}-${parsed.subtype}/${nameForType(mimetype, filename)}`;
}

export async function sharedMediaIntoState(
  media: Api.SharedMediaWithMetadata,
  search: string,
): Promise<Draft<SharedMediaWithMetadataState>> {
  let {
    catalog,
    ...result
  } = await baseMediaIntoState({
    ...media,
    catalog: "",
  }, `/search/${search}`);

  if (!result.file) {
    throw new Error("Unexpected");
  }

  return result;
}

export async function mediaIntoState(
  media: Api.Media,
): Promise<Draft<MediaState>> {
  return baseMediaIntoState(media);
}

export async function baseMediaIntoState(
  media: Api.Media,
  urlPrefix: string = "",
): Promise<Draft<MediaState>> {
  const shouldReplaceZone = (taken: DateTime, gpsZone: Zone): boolean => {
    // Only ever replace non-IANA zones with valid zones.
    if (!gpsZone.isValid || taken.zone instanceof IANAZone) {
      return false;
    }

    // Should always replace a missing or invalid zone.
    if (!hasTimezone(taken) || !taken.zone.isValid) {
      return true;
    }

    return taken.offset == gpsZone.offset(taken.toMillis());
  };

  let store = await Services.store;
  let { thumbnails, encodings, videoEncodings } = store.getState().serverState;

  let { taken, takenZone } = media;

  if (taken) {
    if (takenZone) {
      taken = taken.setZone(takenZone, {
        keepLocalTime: true,
      });
    }

    if (media.latitude && media.longitude) {
      try {
        const { default: tzLookup } = await import("tz-lookup");

        let gpsZone = IANAZone.create(tzLookup(media.latitude, media.longitude));
        if (shouldReplaceZone(taken, gpsZone)) {
          taken = taken.setZone(gpsZone, {
            keepLocalTime: true,
          });
          takenZone = gpsZone.name;
        }
      } catch (e) {
        // ignore
      }
    }
  }

  let file: MediaFileState | null = null;
  if (media.file) {
    let base = `${urlPrefix}/media/${media.id}/${media.file.id}`;

    let thumbs: Thumbnail[] = [];
    for (let encoding of thumbnails.encodings) {
      for (let size of thumbnails.sizes) {
        thumbs.push({
          mimetype: encoding,
          size,
          url: `${base}/thumb/${size}/${encodingUrl(encoding, media.filename)}`,
        });
      }
    }

    file = {
      ...media.file,
      url: `${base}/${media.filename ?? nameForType(media.file.mimetype)}`,
      thumbnails: thumbs,
      encodings: encodings.map((encoding: string) => ({
        mimetype: encoding,
        url: `${base}/encoding/${encodingUrl(encoding, media.filename)}`,
      })),
      videoEncodings: videoEncodings.map((encoding: string) => ({
        mimetype: encoding,
        url: `${base}/encoding/${encodingUrl(encoding, media.filename)}`,
      })),
    };
  }

  return {
    ...media,

    taken,
    takenZone,
    catalog: Catalog.ref(media.catalog),
    file,
  };
}

export function albumIntoState(album: Api.Album): Draft<AlbumState> {
  return {
    ...album,
    catalog: Catalog.ref(album.catalog),
    parent: album.parent ? Album.ref(album.parent) : null,
  };
}

export function tagIntoState(tag: Api.Tag): Draft<TagState> {
  return {
    ...tag,
    catalog: Catalog.ref(tag.catalog),
    parent: tag.parent ? Tag.ref(tag.parent) : null,
  };
}

export function personIntoState(person: Api.Person): Draft<PersonState> {
  return {
    ...person,
    catalog: Catalog.ref(person.catalog),
  };
}

export function searchIntoState(search: Api.SavedSearch): Draft<SavedSearchState> {
  return {
    ...search,
    catalog: Catalog.ref(search.catalog),
  } as Draft<SavedSearchState>;
}

export function userIntoState(user: Api.User): Draft<UserState> {
  interface Maps {
    albums: Map<string, Draft<AlbumState>>;
    tags: Map<string, Draft<TagState>>;
    people: Map<string, Draft<PersonState>>;
    searches: Map<string, Draft<SavedSearchState>>;
  }

  let catalogMaps = new Map<string, Maps>();
  let catalogMap = (id: string): Maps => {
    let maps = catalogMaps.get(id);
    if (maps) {
      return maps;
    }

    maps = {
      albums: new Map(),
      tags: new Map(),
      people: new Map(),
      searches: new Map(),
    };
    catalogMaps.set(id, maps);
    return maps;
  };

  let { albums, tags, people, searches, catalogs, ...rest } = user;

  for (let album of albums) {
    let maps = catalogMap(album.catalog);
    maps.albums.set(album.id, albumIntoState(album));
  }

  for (let tag of tags) {
    let maps = catalogMap(tag.catalog);
    maps.tags.set(tag.id, tagIntoState(tag));
  }

  for (let person of people) {
    let maps = catalogMap(person.catalog);
    maps.people.set(person.id, personIntoState(person));
  }

  for (let search of searches) {
    let maps = catalogMap(search.catalog);
    maps.searches.set(search.id, searchIntoState(search));
  }

  return {
    ...rest,
    created: isoDateTime(rest.created),
    lastLogin: rest.lastLogin ? isoDateTime(rest.lastLogin) : null,
    storage: intoMap(user.storage),
    catalogs: new Map(
      catalogs.map((catalog: Api.Catalog): [string, Draft<CatalogState>] => {
        return [
          catalog.id,
          {
            ...catalog,
            ...catalogMap(catalog.id),
          },
        ];
      }),
    ),
  };
}

export function serverStateIntoState(state: Api.State): Draft<ServerState> {
  return {
    ...state,
    user: state.user ? userIntoState(state.user) : null,
  };
}
