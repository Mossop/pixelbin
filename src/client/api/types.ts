import type { Draft } from "immer";

import type { Api, ObjectModel } from "../../model";
import type { Overwrite } from "../../utils";
import { isoDateTime } from "../../utils";
import type { ReadonlyMapOf } from "../utils/maps";
import { intoMap } from "../utils/maps";
import type { Media, Reference } from "./highlevel";
import { Album, Catalog, Person, Tag } from "./highlevel";

type HighLevelForState<State> =
  State extends TagState
    ? Tag
    : State extends AlbumState
      ? Album
      : State extends PersonState
        ? Person
        : State extends CatalogState
          ? Catalog
          : State extends MediaState
            ? Media
            : never;

export type Create<T> = Omit<T, "id">;
export type Patch<T> = Overwrite<Partial<Omit<T, "catalog">>, {
  id: Reference<HighLevelForState<T>>;
}>;

export interface MediaPersonState {
  person: Reference<Person>;
  location: ObjectModel.Location | null;
}

export type StorageState = Api.Storage;
export type PersonState = Overwrite<Readonly<ObjectModel.Person>, {
  readonly catalog: Reference<Catalog>;
}>;
export type TagState = Overwrite<Readonly<ObjectModel.Tag>, {
  readonly parent: Reference<Tag> | null;
  readonly catalog: Reference<Catalog>;
}>;
export type AlbumState = Overwrite<Readonly<ObjectModel.Album>, {
  readonly parent: Reference<Album> | null;
  readonly catalog: Reference<Catalog>;
}>;
export type SavedSearchState = Overwrite<Readonly<ObjectModel.SavedSearch>, {
  readonly catalog: Reference<Catalog>;
}>;
export type CatalogState = Overwrite<Readonly<ObjectModel.Catalog>, {
  readonly tags: ReadonlyMapOf<TagState>;
  readonly albums: ReadonlyMapOf<AlbumState>;
  readonly people: ReadonlyMapOf<PersonState>;
  readonly searches: ReadonlyMapOf<SavedSearchState>;
}>;
export type UserState = Overwrite<Readonly<Omit<ObjectModel.User, "created" | "lastLogin">>, {
  readonly created: string;
  readonly storage: ReadonlyMapOf<StorageState>;
  readonly catalogs: ReadonlyMapOf<CatalogState>;
}>;
export interface ServerState {
  readonly user: UserState | null;
}
export type UnprocessedMediaState = Overwrite<Readonly<Api.UnprocessedMedia>, {
  readonly tags: readonly Reference<Tag>[];
  readonly albums: readonly Reference<Album>[];
  readonly people: readonly MediaPersonState[];
}>;
export type ProcessedMediaState = Overwrite<Readonly<Api.ProcessedMedia>, {
  readonly tags: readonly Reference<Tag>[];
  readonly albums: readonly Reference<Album>[];
  readonly people: readonly MediaPersonState[];
}>;
export type MediaState = UnprocessedMediaState | ProcessedMediaState;
export interface OriginalState extends Readonly<ObjectModel.Original> {}

export function isProcessed(media: MediaState): media is ProcessedMediaState {
  return "uploaded" in media && !!media.uploaded;
}

export function isUnprocessed(media: MediaState): media is UnprocessedMediaState {
  return !isProcessed(media);
}

export function mediaIntoState(media: Api.UnprocessedMedia): Draft<UnprocessedMediaState>;
export function mediaIntoState(media: Api.ProcessedMedia): Draft<ProcessedMediaState>;
export function mediaIntoState(media: Api.Media): Draft<MediaState>;
export function mediaIntoState(media: Api.Media): Draft<MediaState> {
  return {
    ...media,

    albums: media.albums.map((album: Api.Album): Reference<Album> => Album.ref(album.id)),
    tags: media.tags.map((tag: Api.Tag): Reference<Tag> => Tag.ref(tag.id)),
    people: media.people.map((person: Api.MediaPerson): MediaPersonState => ({
      person: Person.ref(person.id),
      location: person.location,
    })),
  };
}

export function albumIntoState(album: Api.Album): AlbumState {
  return {
    ...album,
    catalog: Catalog.ref(album.catalog),
    parent: album.parent ? Album.ref(album.parent) : null,
  };
}

export function tagIntoState(tag: Api.Tag): TagState {
  return {
    ...tag,
    catalog: Catalog.ref(tag.catalog),
    parent: tag.parent ? Tag.ref(tag.parent) : null,
  };
}

export function personIntoState(person: Api.Person): PersonState {
  return {
    ...person,
    catalog: Catalog.ref(person.catalog),
  };
}

export function searchIntoState(search: Api.SavedSearch): SavedSearchState {
  return {
    ...search,
    catalog: Catalog.ref(search.catalog),
  };
}

export function userIntoState(user: Api.User): UserState {
  interface Maps {
    albums: Map<string, AlbumState>;
    tags: Map<string, TagState>;
    people: Map<string, PersonState>;
    searches: Map<string, SavedSearchState>;
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
    storage: intoMap(user.storage),
    catalogs: new Map(
      catalogs.map((catalog: Api.Catalog): [string, CatalogState] => {
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

export function serverStateIntoState(state: Api.State): ServerState {
  return {
    user: state.user ? userIntoState(state.user) : null,
  };
}
