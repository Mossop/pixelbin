import type { Draft } from "immer";
import type { Zone } from "luxon";
import { IANAZone } from "luxon";

import type { Api, ObjectModel } from "../../model";
import type { Overwrite, DateTime } from "../../utils";
import { hasTimezone, isoDateTime } from "../../utils";
import type { ReadonlyMapOf } from "../utils/maps";
import { intoMap } from "../utils/maps";
import type { Reference } from "./highlevel";
import { Album, Catalog, Person, Tag } from "./highlevel";

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

export type MediaState = Overwrite<Api.Media, {
  catalog: Reference<Catalog>;
  albums: MediaAlbumState[];
  tags: MediaTagState[];
  people: MediaPersonState[];
}>;

export type ProcessedMediaState = Overwrite<MediaState, {
  file: NonNullable<MediaState["file"]>;
}>;

export function isProcessedMedia(media: MediaState): media is ProcessedMediaState {
  return !!media.file;
}

export type PublicMediaState = Api.PublicMedia;
export type PublicMediaWithMetadataState = Api.PublicMediaWithMetadata;

export interface ServerState {
  readonly user: UserState | null;
}

export async function mediaIntoState(media: Api.Media): Promise<Draft<MediaState>> {
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

  return {
    ...media,

    taken,
    takenZone,
    catalog: Catalog.ref(media.catalog),
    albums: media.albums.map((album: Api.MediaAlbum): Draft<MediaAlbumState> => ({
      album: Album.ref(album.album),
    })),
    tags: media.tags.map((tag: Api.MediaTag): Draft<MediaTagState> => ({
      tag: Tag.ref(tag.tag),
    })),
    people: media.people.map((person: Api.MediaPerson): Draft<MediaPersonState> => ({
      person: Person.ref(person.person),
      location: person.location,
    })),
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
    user: state.user ? userIntoState(state.user) : null,
  };
}
