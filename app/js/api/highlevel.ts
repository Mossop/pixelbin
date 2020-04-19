import type { Immutable } from "immer";

import actions from "../store/actions";
import type { ServerState } from "../store/types";
import { exception, ErrorCode, processException, throwException } from "../utils/exception";
import { intoId, isInstance } from "../utils/maps";
import type { MapId } from "../utils/maps";
import type { MediaData } from "./media";
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isReference<T>(data: any): data is Reference<T> {
  return typeof data == "object" && "deref" in data;
}

export type Media = MediaData;
export function mediaRef(media: Media): Reference<Media> {
  return {
    id: media.id,
    deref: (): Media => media,
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

  public static ref(data: MapId<TagData>): Reference<Tag> {
    return new APIItemReference(intoId(data), Tag);
  }

  public ref(): Reference<Tag> {
    return new APIItemReference(this.id, Tag);
  }

  private static innerFromState(serverState: ServerState, item: MapId<Immutable<TagData>>): Tag {
    let id = intoId(item);

    let cache = getStateCache(serverState);
    let tag = cache.tags.get(id);
    if (tag) {
      return tag;
    }

    if (isInstance(item)) {
      tag = new Tag(serverState, item);
      cache.tags.set(id, tag);
      return tag;
    }

    let { user } = serverState;
    if (!user) {
      throwException(ErrorCode.NotLoggedIn);
    }

    for (let catalog of user.catalogs.values()) {
      let tagState = catalog.tags.get(id);
      if (tagState) {
        tag = new Tag(serverState, tagState);
        cache.tags.set(id, tag);
        return tag;
      }
    }

    throwException(ErrorCode.UnknownTag);
  }

  public static safeFromState(
    serverState: ServerState,
    item: MapId<Immutable<TagData>>,
  ): Tag | undefined {
    try {
      return Tag.innerFromState(serverState, item);
    } catch (e) {
      return undefined;
    }
  }

  public static fromState(serverState: ServerState, item: MapId<Immutable<TagData>>): Tag {
    try {
      return Tag.innerFromState(serverState, item);
    } catch (e) {
      processException(e);
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

  private static innerFromState(
    serverState: ServerState,
    item: MapId<Immutable<PersonData>>,
  ): Person {
    let id = intoId(item);

    let cache = getStateCache(serverState);
    let person = cache.people.get(id);
    if (person) {
      return person;
    }

    if (isInstance(item)) {
      person = new Person(serverState, item);
      cache.people.set(id, person);
      return person;
    }

    let { user } = serverState;
    if (!user) {
      throwException(ErrorCode.NotLoggedIn);
    }

    for (let catalog of user.catalogs.values()) {
      let personState = catalog.people.get(id);
      if (personState) {
        person = new Person(serverState, personState);
        cache.people.set(id, person);
        return person;
      }
    }

    throwException(ErrorCode.UnknownPerson);
  }

  public static safeFromState(
    serverState: ServerState,
    item: MapId<Immutable<PersonData>>,
  ): Person | undefined {
    try {
      return Person.innerFromState(serverState, item);
    } catch (e) {
      return undefined;
    }
  }

  public static fromState(serverState: ServerState, item: MapId<Immutable<PersonData>>): Person {
    try {
      return Person.innerFromState(serverState, item);
    } catch (e) {
      processException(e);
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
        (albumState: Immutable<AlbumData>): Album => Album.fromState(this.serverState, albumState),
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

  private static innerFromState(
    serverState: ServerState,
    item: MapId<Immutable<AlbumData>>,
  ): Album {
    let id = intoId(item);

    let cache = getStateCache(serverState);
    let album = cache.albums.get(id);
    if (album) {
      return album;
    }

    if (isInstance(item)) {
      album = new Album(serverState, item);
      cache.albums.set(id, album);
      return album;
    }

    let { user } = serverState;
    if (!user) {
      throwException(ErrorCode.NotLoggedIn);
    }

    for (let catalog of user.catalogs.values()) {
      let state = catalog.albums.get(id);
      if (state) {
        album = new Album(serverState, state);
        cache.albums.set(id, album);
        return album;
      }
    }

    throwException(ErrorCode.UnknownAlbum);
  }

  public static safeFromState(
    serverState: ServerState,
    item: MapId<Immutable<AlbumData>>,
  ): Album | undefined {
    try {
      return Album.innerFromState(serverState, item);
    } catch (e) {
      return undefined;
    }
  }

  public static fromState(serverState: ServerState, item: MapId<Immutable<AlbumData>>): Album {
    try {
      return Album.innerFromState(serverState, item);
    } catch (e) {
      processException(e);
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
      .map((album: Immutable<AlbumData>): Album => Album.fromState(this.serverState, album));
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
    return Array.from(this.state.tags.values()).map(
      (tag: Immutable<TagData>): Tag => Tag.fromState(this.serverState, tag),
    );
  }

  public getAlbum(id: string): Album | undefined {
    let albumState = this.state.albums.get(id);
    if (albumState) {
      return Album.fromState(this.serverState, albumState);
    }
    return undefined;
  }

  public get albums(): Album[] {
    return Array.from(this.state.albums.values()).map(
      (album: Immutable<AlbumData>): Album => Album.fromState(this.serverState, album),
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
    return Array.from(this.state.people.values()).map(
      (person: Immutable<PersonData>): Person => Person.fromState(this.serverState, person),
    );
  }

  public static ref(data: MapId<CatalogData>): Reference<Catalog> {
    return new APIItemReference(intoId(data), Catalog);
  }

  public ref(): Reference<Catalog> {
    return new APIItemReference(this.id, Catalog);
  }

  private static innerFromState(
    serverState: ServerState,
    item: MapId<Immutable<CatalogData>>,
  ): Catalog {
    let id: string = intoId(item);

    let cache = getStateCache(serverState);
    let catalog = cache.catalogs.get(id);
    if (catalog) {
      return catalog;
    }

    if (isInstance(item)) {
      catalog = new Catalog(serverState, item);
      cache.catalogs.set(id, catalog);
      return catalog;
    }

    let { user } = serverState;
    if (!user) {
      throwException(ErrorCode.NotLoggedIn);
    }

    let state = user.catalogs.get(id);
    if (state) {
      catalog = new Catalog(serverState, state);
      cache.catalogs.set(id, catalog);
      return catalog;
    }

    throwException(ErrorCode.UnknownCatalog);
  }

  public static safeFromState(
    serverState: ServerState,
    item: MapId<Immutable<CatalogData>>,
  ): Catalog | undefined {
    try {
      return Catalog.innerFromState(serverState, item);
    } catch (e) {
      return undefined;
    }
  }

  public static fromState(serverState: ServerState, item: MapId<Immutable<CatalogData>>): Catalog {
    try {
      return Catalog.innerFromState(serverState, item);
    } catch (e) {
      processException(e);
    }
  }
}

export function catalogs(serverState: ServerState): Catalog[] {
  if (serverState.user) {
    return Array.from(
      serverState.user.catalogs.values(),
      (st: Immutable<CatalogData>): Catalog => Catalog.fromState(serverState, st),
    );
  }
  return [];
}

