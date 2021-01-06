import { useCallback } from "react";

import type { Query } from "../../model";
import { memoized } from "../../utils/memo";
import { useSelector } from "../store";
import type { StoreState } from "../store/types";
import { exception, ErrorCode } from "../utils/exception";
import { intoId } from "../utils/maps";
import type { MapId } from "../utils/maps";
import type {
  ServerState,
  CatalogState,
  AlbumState,
  TagState,
  PersonState,
  MediaState,
  SavedSearchState,
} from "./types";

export interface APIItemBuilder<T> {
  fromState: (serverState: ServerState, id: string) => T;
}

// Fake interface
export interface Reference<T> {
  fakeType: "Reference";
  base: APIItemBuilder<T>;
}

export function refId<T>(ref: Reference<T>): string {
  return ref as unknown as string;
}

export function deref<T>(type: APIItemBuilder<T>, ref: Reference<T>, serverState: ServerState): T {
  return type.fromState(serverState, ref as unknown as string);
}

export function refIs(
  a: Reference<unknown> | string | null | undefined,
  b: Reference<unknown> | string | null | undefined,
): boolean {
  return Object.is(a, b);
}

function ref<T>(type: APIItemBuilder<T>, id: string): Reference<T> {
  return id as unknown as Reference<T>;
}

export type Media = MediaState;

interface ItemState {
  id: string;
}

export abstract class APIItem<T extends ItemState> {
  protected constructor(
    protected readonly serverState: ServerState,
    protected readonly state: T,
  ) {}

  public get id(): string {
    return this.state.id;
  }

  public toState(): T {
    return {
      ...this.state,
    };
  }

  public ref<S extends ItemState, T extends APIItem<S>>(this: T): Reference<T> {
    return this.id as unknown as Reference<T>;
  }
}

export class Tag extends APIItem<TagState> {
  public get catalog(): Catalog {
    return deref(Catalog, this.state.catalog, this.serverState);
  }

  public get name(): string {
    return this.state.name;
  }

  public get parent(): Tag | undefined {
    return this.state.parent
      ? deref(Tag, this.state.parent, this.serverState)
      : undefined;
  }

  public get children(): Tag[] {
    let { user } = this.serverState;
    if (!user) {
      exception(ErrorCode.NotLoggedIn);
    }

    let catalogState: CatalogState | undefined = user.catalogs.get(refId(this.state.catalog));

    if (!catalogState) {
      exception(ErrorCode.UnknownCatalog);
    }

    return Array.from(catalogState.tags.values())
      .filter((tagState: TagState): boolean => refIs(tagState.parent, this.id))
      .map(
        (tagState: TagState): Tag =>
          Tag.fromState(this.serverState, tagState.id),
      );
  }

  public static ref(data: MapId<TagState>): Reference<Tag> {
    return ref(Tag, intoId(data));
  }

  public static fromState = memoized((serverState: ServerState, id: string): Tag => {
    let { user } = serverState;
    if (!user) {
      exception(ErrorCode.NotLoggedIn);
    }

    for (let catalog of user.catalogs.values()) {
      let tagState = catalog.tags.get(id);
      if (tagState) {
        return new Tag(serverState, tagState);
      }
    }

    exception(ErrorCode.UnknownTag);
  });

  public static safeFromState(
    serverState: ServerState,
    id: string,
  ): Tag | undefined {
    try {
      return Tag.fromState(serverState, id);
    } catch (e) {
      return undefined;
    }
  }
}

export class Person extends APIItem<PersonState> {
  public get catalog(): Catalog {
    return deref(Catalog, this.state.catalog, this.serverState);
  }

  public get name(): string {
    return this.state.name;
  }

  public static ref(data: MapId<PersonState>): Reference<Person> {
    return ref(Person, intoId(data));
  }

  public static fromState = memoized((serverState: ServerState, id: string): Person => {
    let { user } = serverState;
    if (!user) {
      exception(ErrorCode.NotLoggedIn);
    }

    for (let catalog of user.catalogs.values()) {
      let personState = catalog.people.get(id);
      if (personState) {
        return new Person(serverState, personState);
      }
    }

    exception(ErrorCode.UnknownPerson);
  });

  public static safeFromState(
    serverState: ServerState,
    id: string,
  ): Person | undefined {
    try {
      return Person.fromState(serverState, id);
    } catch (e) {
      return undefined;
    }
  }
}

export class Album extends APIItem<AlbumState> {
  public get catalog(): Catalog {
    return deref(Catalog, this.state.catalog, this.serverState);
  }

  public get name(): string {
    return this.state.name;
  }

  public get parent(): Album | undefined {
    return this.state.parent
      ? deref(Album, this.state.parent, this.serverState)
      : undefined;
  }

  public get children(): Album[] {
    let { user } = this.serverState;
    if (!user) {
      exception(ErrorCode.NotLoggedIn);
    }

    let catalogState: CatalogState | undefined = user.catalogs.get(refId(this.state.catalog));

    if (!catalogState) {
      exception(ErrorCode.UnknownCatalog);
    }

    return Array.from(catalogState.albums.values())
      .filter((albumState: AlbumState): boolean => refIs(albumState.parent, this.id))
      .map(
        (albumState: AlbumState): Album =>
          Album.fromState(this.serverState, albumState.id),
      );
  }

  public isAncestorOf(album: Album): boolean {
    let { parent } = album;
    while (parent) {
      if (parent == this) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  public static ref(data: MapId<AlbumState>): Reference<Album> {
    return ref(Album, intoId(data));
  }

  public static fromState = memoized((serverState: ServerState, id: string): Album => {
    let { user } = serverState;
    if (!user) {
      exception(ErrorCode.NotLoggedIn);
    }

    for (let catalog of user.catalogs.values()) {
      let state = catalog.albums.get(id);
      if (state) {
        return new Album(serverState, state);
      }
    }

    exception(ErrorCode.UnknownAlbum);
  });

  public static safeFromState(
    serverState: ServerState,
    id: string,
  ): Album | undefined {
    try {
      return Album.fromState(serverState, id);
    } catch (e) {
      return undefined;
    }
  }
}

export class Catalog extends APIItem<CatalogState> {
  public get name(): string {
    return this.state.name;
  }

  public get rootAlbums(): Album[] {
    return Array.from(this.state.albums.values())
      .filter((album: AlbumState): boolean => !album.parent)
      .map((album: AlbumState): Album => Album.fromState(this.serverState, album.id));
  }

  public get rootTags(): Tag[] {
    return Array.from(this.state.tags.values())
      .filter((tag: TagState): boolean => !tag.parent)
      .map((tag: TagState): Tag => Tag.fromState(this.serverState, tag.id));
  }

  public get tags(): Tag[] {
    return Array.from(
      this.state.tags.keys(),
      (id: string): Tag => Tag.fromState(this.serverState, id),
    );
  }

  public getAlbum(id: string): Album | undefined {
    let album = Album.safeFromState(this.serverState, id);
    if (album?.catalog !== this) {
      return undefined;
    }
    return album;
  }

  public get albums(): Album[] {
    return Array.from(
      this.state.albums.keys(),
      (id: string): Album => Album.fromState(this.serverState, id),
    );
  }

  public get people(): Person[] {
    return Array.from(
      this.state.people.keys(),
      (id: string): Person => Person.fromState(this.serverState, id),
    );
  }

  public get searches(): SavedSearch[] {
    return Array.from(
      this.state.searches.keys(),
      (id: string): SavedSearch => SavedSearch.fromState(this.serverState, id),
    );
  }

  public static ref(data: MapId<CatalogState>): Reference<Catalog> {
    return ref(Catalog, intoId(data));
  }

  public static fromState = memoized((serverState: ServerState, id: string): Catalog => {
    let { user } = serverState;
    if (!user) {
      exception(ErrorCode.NotLoggedIn);
    }

    let state = user.catalogs.get(id);
    if (state) {
      return new Catalog(serverState, state);
    }

    exception(ErrorCode.UnknownCatalog);
  });

  public static safeFromState(
    serverState: ServerState,
    id: string,
  ): Catalog | undefined {
    try {
      return Catalog.fromState(serverState, id);
    } catch (e) {
      return undefined;
    }
  }
}

export class SavedSearch extends APIItem<SavedSearchState> {
  public get catalog(): Catalog {
    return deref(Catalog, this.state.catalog, this.serverState);
  }

  public get name(): string {
    return this.state.name;
  }

  public get shared(): boolean {
    return this.state.shared;
  }

  public get query(): Query {
    return this.state.query;
  }

  public static ref(data: MapId<SavedSearchState>): Reference<SavedSearch> {
    return ref(SavedSearch, intoId(data));
  }

  public static fromState = memoized((serverState: ServerState, id: string): SavedSearch => {
    let { user } = serverState;
    if (!user) {
      exception(ErrorCode.NotLoggedIn);
    }

    for (let catalog of user.catalogs.values()) {
      let searchState = catalog.searches.get(id);
      if (searchState) {
        return new SavedSearch(serverState, searchState);
      }
    }

    exception(ErrorCode.UnknownSearch);
  });

  public static safeFromState(
    serverState: ServerState,
    id: string,
  ): SavedSearch | undefined {
    try {
      return SavedSearch.fromState(serverState, id);
    } catch (e) {
      return undefined;
    }
  }
}

export const catalogs = memoized(function catalogs(serverState: ServerState): Catalog[] {
  if (serverState.user) {
    return Array.from(
      serverState.user.catalogs.keys(),
      (id: string): Catalog => Catalog.fromState(serverState, id),
    );
  }
  return [];
});

function catalogSelector(state: StoreState): Catalog[] {
  return catalogs(state.serverState);
}

export function useCatalogs(): Catalog[] {
  return useSelector(catalogSelector);
}

export function useReference<T>(type: APIItemBuilder<T>, reference: Reference<T>): T;
export function useReference<T>(type: APIItemBuilder<T>, reference: Reference<T> | null): T | null {
  return useSelector(
    useCallback(
      (state: StoreState): T | null => reference ? deref(type, reference, state.serverState) : null,
      [type, reference],
    ),
  );
}
