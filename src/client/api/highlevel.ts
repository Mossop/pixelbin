import type { Query } from "../../model";
import { useSelector } from "../store";
import type { StoreState } from "../store/types";
import { exception, ErrorCode } from "../utils/exception";
import { intoId } from "../utils/maps";
import type { MapId } from "../utils/maps";
import type { VirtualTreeOptions } from "../utils/virtual";
import {
  VirtualAlbum,
  VirtualCatalog,
  VirtualPerson,
  VirtualTag,
  VirtualTree,
  VirtualSearch,
} from "../utils/virtual";
import type {
  ServerState,
  CatalogState,
  AlbumState,
  TagState,
  PersonState,
  MediaState,
  SavedSearchState,
} from "./types";

interface StateCache {
  readonly albums: Map<string, Album>;
  readonly tags: Map<string, Tag>;
  readonly people: Map<string, Person>;
  readonly catalogs: Map<string, Catalog>;
  readonly searches: Map<string, SavedSearch>;
}

const STATE_CACHE: WeakMap<ServerState, StateCache> = new WeakMap();

function buildStateCache(serverState: ServerState): StateCache {
  let cache: StateCache = {
    albums: new Map<string, Album>(),
    tags: new Map<string, Tag>(),
    people: new Map<string, Person>(),
    catalogs: new Map<string, Catalog>(),
    searches: new Map<string, SavedSearch>(),
  };
  STATE_CACHE.set(serverState, cache);
  return cache;
}

function getStateCache(serverState: ServerState): StateCache {
  return STATE_CACHE.get(serverState) ?? buildStateCache(serverState);
}

export interface APIItemBuilder<T> {
  fromState: (serverState: ServerState, id: string) => T;
}

export type Dereferenced<T> = T extends Reference<infer R> ? R : T;

export interface Reference<T> {
  readonly id: string;
  readonly deref: (serverState: ServerState) => T;
  readonly toString: () => string;
}

export type Media = MediaState;
export function mediaRef(media: MediaState): Reference<Media> {
  return {
    id: media.id,
    deref: (): MediaState => media,
    toString: (): string => media.id,
  };
}

export type Derefer = <T>(ref: Reference<T> | undefined) => T | undefined;

export function dereferencer(serverState: ServerState): Derefer {
  return <T>(ref: Reference<T> | undefined): T | undefined => ref?.deref(serverState);
}

export interface Referencable<T> {
  ref: () => Reference<T>;
}

interface Pending<T> {
  readonly ref: Reference<T> | undefined;
  readonly promise: Promise<Reference<T>>;
}

export class APIItemReference<T> implements Reference<T> {
  public constructor(public readonly id: string, private cls: APIItemBuilder<T>) {}

  public deref(serverState: ServerState): T {
    return this.cls.fromState(serverState, this.id);
  }

  public toString(): string {
    return this.id;
  }
}

export class PendingAPIItem<T> implements Pending<T> {
  private foundRef: Reference<T> | undefined = undefined;

  public constructor(public readonly promise: Promise<Reference<T>>) {
    void promise.then((ref: Reference<T>): void => {
      this.foundRef = ref;
    });
  }

  public get ref(): Reference<T> | undefined {
    return this.foundRef;
  }
}

export abstract class APIItem<T> {
  public abstract get id(): string;
  public abstract ref(): Reference<T>;
}

export class Tag implements Referencable<Tag> {
  private constructor(
    private readonly serverState: ServerState,
    private readonly state: TagState,
  ) {}

  public toState(): TagState {
    return {
      ...this.state,
    };
  }

  public get catalog(): Catalog {
    return this.state.catalog.deref(this.serverState);
  }

  public get id(): string {
    return this.state.id;
  }

  public get name(): string {
    return this.state.name;
  }

  public get parent(): Tag | undefined {
    return this.state.parent?.deref(this.serverState);
  }

  public get children(): Tag[] {
    let { user } = this.serverState;
    if (!user) {
      exception(ErrorCode.NotLoggedIn);
    }

    let catalogState: CatalogState | undefined = user.catalogs.get(this.state.catalog.id);

    if (!catalogState) {
      exception(ErrorCode.UnknownCatalog);
    }

    return Array.from(catalogState.tags.values())
      .filter((tagState: TagState): boolean => tagState.parent?.id == this.id)
      .map(
        (tagState: TagState): Tag =>
          Tag.fromState(this.serverState, tagState.id),
      );
  }

  public virtual(treeType: VirtualTreeOptions = VirtualTree.All): VirtualTag {
    return new VirtualTag(this, treeType);
  }

  public static ref(data: MapId<TagState>): Reference<Tag> {
    return new APIItemReference(intoId(data), Tag);
  }

  public ref(): Reference<Tag> {
    return new APIItemReference(this.id, Tag);
  }

  public static fromState(serverState: ServerState, id: string): Tag {
    let cache = getStateCache(serverState);
    let tag = cache.tags.get(id);
    if (tag) {
      return tag;
    }

    let { user } = serverState;
    if (!user) {
      exception(ErrorCode.NotLoggedIn);
    }

    for (let catalog of user.catalogs.values()) {
      let tagState = catalog.tags.get(id);
      if (tagState) {
        tag = new Tag(serverState, tagState);
        cache.tags.set(id, tag);
        return tag;
      }
    }

    exception(ErrorCode.UnknownTag);
  }

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

export class Person implements Referencable<Person> {
  private constructor(
    private readonly serverState: ServerState,
    private readonly state: PersonState,
  ) {}

  public toState(): PersonState {
    return {
      ...this.state,
    };
  }

  public get catalog(): Catalog {
    return this.state.catalog.deref(this.serverState);
  }

  public get id(): string {
    return this.state.id;
  }

  public get name(): string {
    return this.state.name;
  }

  public static ref(data: MapId<PersonState>): Reference<Person> {
    return new APIItemReference(intoId(data), Person);
  }

  public virtual(treeType: VirtualTreeOptions = VirtualTree.All): VirtualPerson {
    return new VirtualPerson(this, treeType);
  }

  public ref(): Reference<Person> {
    return new APIItemReference(this.id, Person);
  }

  public static fromState(
    serverState: ServerState,
    id: string,
  ): Person {
    let cache = getStateCache(serverState);
    let person = cache.people.get(id);
    if (person) {
      return person;
    }

    let { user } = serverState;
    if (!user) {
      exception(ErrorCode.NotLoggedIn);
    }

    for (let catalog of user.catalogs.values()) {
      let personState = catalog.people.get(id);
      if (personState) {
        person = new Person(serverState, personState);
        cache.people.set(id, person);
        return person;
      }
    }

    exception(ErrorCode.UnknownPerson);
  }

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

export class Album implements Referencable<Album> {
  private constructor(
    private readonly serverState: ServerState,
    private readonly state: AlbumState,
  ) {}

  public toState(): AlbumState {
    return {
      ...this.state,
    };
  }

  public get id(): string {
    return this.state.id;
  }

  public get catalog(): Catalog {
    return this.state.catalog.deref(this.serverState);
  }

  public get name(): string {
    return this.state.name;
  }

  public get parent(): Album | undefined {
    return this.state.parent?.deref(this.serverState);
  }

  public get children(): Album[] {
    let { user } = this.serverState;
    if (!user) {
      exception(ErrorCode.NotLoggedIn);
    }

    let catalogState: CatalogState | undefined = user.catalogs.get(this.state.catalog.id);

    if (!catalogState) {
      exception(ErrorCode.UnknownCatalog);
    }

    return Array.from(catalogState.albums.values())
      .filter((albumState: AlbumState): boolean => albumState.parent?.id == this.id)
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

  public virtual(treeType: VirtualTreeOptions = VirtualTree.All): VirtualAlbum {
    return new VirtualAlbum(this, treeType);
  }

  public static ref(data: MapId<AlbumState>): Reference<Album> {
    return new APIItemReference(intoId(data), Album);
  }

  public ref(): Reference<Album> {
    return new APIItemReference(this.id, Album);
  }

  public static fromState(
    serverState: ServerState,
    id: string,
  ): Album {
    let cache = getStateCache(serverState);
    let album = cache.albums.get(id);
    if (album) {
      return album;
    }

    let { user } = serverState;
    if (!user) {
      exception(ErrorCode.NotLoggedIn);
    }

    for (let catalog of user.catalogs.values()) {
      let state = catalog.albums.get(id);
      if (state) {
        album = new Album(serverState, state);
        cache.albums.set(id, album);
        return album;
      }
    }

    exception(ErrorCode.UnknownAlbum);
  }

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

export class Catalog implements Referencable<Catalog> {
  private constructor(
    private readonly serverState: ServerState,
    private readonly state: CatalogState,
  ) {}

  public toState(): CatalogState {
    return {
      ...this.state,
    };
  }

  public get id(): string {
    return this.state.id;
  }

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

  public virtual(treeType: VirtualTreeOptions = VirtualTree.All): VirtualCatalog {
    return new VirtualCatalog(this, treeType);
  }

  public static ref(data: MapId<CatalogState>): Reference<Catalog> {
    return new APIItemReference(intoId(data), Catalog);
  }

  public ref(): Reference<Catalog> {
    return new APIItemReference(this.id, Catalog);
  }

  public static fromState(
    serverState: ServerState,
    id: string,
  ): Catalog {
    let cache = getStateCache(serverState);
    let catalog = cache.catalogs.get(id);
    if (catalog) {
      return catalog;
    }

    let { user } = serverState;
    if (!user) {
      exception(ErrorCode.NotLoggedIn);
    }

    let state = user.catalogs.get(id);
    if (state) {
      catalog = new Catalog(serverState, state);
      cache.catalogs.set(id, catalog);
      return catalog;
    }

    exception(ErrorCode.UnknownCatalog);
  }

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

export class SavedSearch implements Referencable<SavedSearch> {
  private constructor(
    private readonly serverState: ServerState,
    private readonly state: SavedSearchState,
  ) {}

  public toState(): SavedSearchState {
    return {
      ...this.state,
    };
  }

  public get catalog(): Catalog {
    return this.state.catalog.deref(this.serverState);
  }

  public get id(): string {
    return this.state.id;
  }

  public get name(): string {
    return this.state.name;
  }

  public get query(): Query {
    return this.state.query;
  }

  public static ref(data: MapId<SavedSearchState>): Reference<SavedSearch> {
    return new APIItemReference(intoId(data), SavedSearch);
  }

  public virtual(treeType: VirtualTreeOptions = VirtualTree.All): VirtualSearch {
    return new VirtualSearch(this, treeType);
  }

  public ref(): Reference<SavedSearch> {
    return new APIItemReference(this.id, SavedSearch);
  }

  public static fromState(
    serverState: ServerState,
    id: string,
  ): SavedSearch {
    let cache = getStateCache(serverState);
    let search = cache.searches.get(id);
    if (search) {
      return search;
    }

    let { user } = serverState;
    if (!user) {
      exception(ErrorCode.NotLoggedIn);
    }

    for (let catalog of user.catalogs.values()) {
      let searchState = catalog.searches.get(id);
      if (searchState) {
        search = new SavedSearch(serverState, searchState);
        cache.searches.set(id, search);
        return search;
      }
    }

    exception(ErrorCode.UnknownSearch);
  }

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

export function catalogs(serverState: ServerState): Catalog[] {
  if (serverState.user) {
    return Array.from(
      serverState.user.catalogs.keys(),
      (id: string): Catalog => Catalog.fromState(serverState, id),
    );
  }
  return [];
}

export function useCatalogs(): Catalog[] {
  return useSelector((state: StoreState): Catalog[] => catalogs(state.serverState));
}

export function useReference<T>(reference: Reference<T>): T;
export function useReference<T>(reference: Reference<T> | null): T | null {
  return useSelector(
    (state: StoreState): T | null => reference?.deref(state.serverState) ?? null,
  );
}
