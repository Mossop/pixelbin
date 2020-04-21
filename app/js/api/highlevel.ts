import type { Immutable } from "immer";

import actions from "../store/actions";
import type { ServerState } from "../store/types";
import { exception, ErrorCode } from "../utils/exception";
import { intoId } from "../utils/maps";
import type { MapId } from "../utils/maps";
import type { ProcessedMediaData, UnprocessedMediaData } from "./media";
import type { AlbumData, CatalogData, TagData, PersonData } from "./types";

interface StateCache {
  readonly albums: Map<string, Album>;
  readonly tags: Map<string, Tag>;
  readonly people: Map<string, Person>;
  readonly catalogs: Map<string, Catalog>;
}

const STATE_CACHE: WeakMap<ServerState, StateCache> = new WeakMap();

function buildStateCache(serverState: ServerState): StateCache {
  let cache: StateCache = {
    albums: new Map(),
    tags: new Map(),
    people: new Map(),
    catalogs: new Map(),
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

export interface Reference<T> {
  readonly id: string;
  readonly deref: (serverState: ServerState) => T;
  readonly toString: () => string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isReference<T>(data: any): data is Reference<T> {
  return typeof data == "object" && "deref" in data;
}

export type Media = ProcessedMediaData | UnprocessedMediaData;
export function mediaRef(media: Media): Reference<Media> {
  return {
    id: media.id,
    deref: (): Media => media,
    toString: (): string => media.id,
  };
}

export type Derefer = <T>(ref: Reference<T> | undefined) => T | undefined;

export function derefer(serverState: ServerState): Derefer {
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

class PendingAPIItem<T> implements Pending<T> {
  private foundRef: Reference<T> | undefined = undefined;

  public constructor(public readonly promise: Promise<Reference<T>>) {
    promise.then((ref: Reference<T>): void => {
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
    private readonly state: Immutable<TagData>,
  ) {}

  public get catalog(): Catalog {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
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
      return [];
    }

    let catalogState: Immutable<CatalogData> | undefined = user.catalogs.get(this.state.catalog.id);

    if (!catalogState) {
      exception(ErrorCode.UnknownCatalog);
    }

    return Array.from(catalogState.tags.values())
      .filter((tagState: Immutable<TagData>): boolean => tagState.parent?.id == this.id)
      .map(
        (tagState: Immutable<TagData>): Tag =>
          Tag.fromState(this.serverState, tagState.id),
      );
  }

  public static ref(data: MapId<TagData>): Reference<Tag> {
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
    private readonly state: Immutable<PersonData>,
  ) {}

  public get catalog(): Catalog {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return this.state.catalog.deref(this.serverState);
  }

  public get id(): string {
    return this.state.id;
  }

  public get name(): string {
    return this.state.name;
  }

  public static ref(data: MapId<PersonData>): Reference<Person> {
    return new APIItemReference(intoId(data), Person);
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
    private readonly state: Immutable<AlbumData>,
  ) {}

  public get id(): string {
    return this.state.id;
  }

  public get catalog(): Catalog {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return this.state.catalog.deref(this.serverState);
  }

  public get stub(): string | null {
    return this.state.stub;
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
      return [];
    }

    let catalogState: Immutable<CatalogData> | undefined = user.catalogs.get(this.state.catalog.id);

    if (!catalogState) {
      exception(ErrorCode.UnknownCatalog);
    }

    return Array.from(catalogState.albums.values())
      .filter((albumState: Immutable<AlbumData>): boolean => albumState.parent?.id == this.id)
      .map(
        (albumState: Immutable<AlbumData>): Album =>
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

  public static ref(data: MapId<AlbumData>): Reference<Album> {
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
    private readonly state: Immutable<CatalogData>,
  ) {}

  public get id(): string {
    return this.state.id;
  }

  public get name(): string {
    return this.state.name;
  }

  public get rootAlbums(): Album[] {
    return Array.from(this.state.albums.values())
      .filter((album: Immutable<AlbumData>): boolean => !album.parent)
      .map((album: Immutable<AlbumData>): Album => Album.fromState(this.serverState, album.id));
  }

  public get rootTags(): Tag[] {
    return Array.from(this.state.tags.values())
      .filter((tag: Immutable<TagData>): boolean => !tag.parent)
      .map((tag: Immutable<TagData>): Tag => Tag.fromState(this.serverState, tag.id));
  }

  public findTag(path: string[]): Pending<Tag> {
    const tagFinder = async (ref: Reference<Catalog>, path: string[]): Promise<Reference<Tag>> => {
      const { findTag } = await import(/* webpackChunkName: "api/tag" */"./tag");
      let tags = await findTag(ref, path);

      const { asyncDispatch } = await import(/* webpackChunkName: "store" */"../store");
      await asyncDispatch(actions.tagsCreated(tags));

      return new APIItemReference(tags[tags.length - 1].id, Tag);
    };

    return new PendingAPIItem(tagFinder(this.ref(), path));
  }

  public get tags(): Tag[] {
    return Array.from(this.state.tags.keys()).map(
      (id: string): Tag => Tag.fromState(this.serverState, id),
    );
  }

  public getAlbum(id: string): Album | undefined {
    return Album.safeFromState(this.serverState, id);
  }

  public get albums(): Album[] {
    return Array.from(this.state.albums.keys()).map(
      (id: string): Album => Album.fromState(this.serverState, id),
    );
  }

  public createPerson(fullname: string): Pending<Person> {
    const personCreator = async (
      ref: Reference<Catalog>,
      name: string,
    ): Promise<Reference<Person>> => {
      const { createPerson } = await import(/* webpackChunkName: "api/person" */"./person");
      let person = await createPerson(ref, name);

      const { asyncDispatch } = await import(/* webpackChunkName: "store" */"../store");
      await asyncDispatch(actions.personCreated(person));

      return new APIItemReference(person.id, Person);
    };

    return new PendingAPIItem(personCreator(this.ref(), fullname));
  }

  public get people(): Person[] {
    return Array.from(this.state.people.keys()).map(
      (id: string): Person => Person.fromState(this.serverState, id),
    );
  }

  public static ref(data: MapId<CatalogData>): Reference<Catalog> {
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

export function catalogs(serverState: ServerState): Catalog[] {
  if (serverState.user) {
    return Array.from(
      serverState.user.catalogs.keys(),
      (id: string): Catalog => Catalog.fromState(serverState, id),
    );
  }
  return [];
}

