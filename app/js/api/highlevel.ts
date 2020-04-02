import { Immutable } from "immer";

import { tagsCreated, personCreated } from "../store/actions";
import { ServerState } from "../store/types";
import { exception, ErrorCode, InternalError, processException } from "../utils/exception";
import { MapId, intoId, isInstance } from "../utils/maps";
import { MediaData } from "./media";
import { createPerson } from "./person";
import { findTag } from "./tag";
import { AlbumData, CatalogData, TagData, PersonData } from "./types";

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
  return typeof data =="object" && "deref" in data;
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
  private id: string | undefined = undefined;
  public readonly promise: Promise<Reference<T>>;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private resolver: (ref: Reference<T>) => void = () => {};

  public constructor(private builder: APIItemBuilder<T>) {
    this.promise = new Promise((resolve: (ref: Reference<T>) => void) => {
      this.resolver = resolve;
    });
  }

  public setId(id: string): void {
    this.id = id;
    this.resolver(new APIItemReference(this.id, this.builder));
  }

  public get ref(): Reference<T> | undefined {
    if (this.id === undefined) {
      return undefined;
    }
    return new APIItemReference(this.id, this.builder);
  }
}

export abstract class APIItem<T> {
  public abstract get id(): string;
  public abstract ref(): Reference<T>;
}

export class Tag implements Referencable<Tag> {
  private constructor(private readonly serverState: ServerState, private readonly state: Immutable<TagData>) {}

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

  public static ref(data: TagData): Reference<Tag> {
    return new APIItemReference(data.id, Tag);
  }

  public ref(): Reference<Tag> {
    return new APIItemReference(this.id, Tag);
  }

  public static fromState(serverState: ServerState, item: MapId<Immutable<TagData>>): Tag {
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

    let user = serverState.user;
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
}

export class Person implements Referencable<Person> {
  private constructor(private readonly serverState: ServerState, private readonly state: Immutable<PersonData>) {}

  public get catalog(): Catalog {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return this.state.catalog.deref(this.serverState);
  }

  public get id(): string {
    return this.state.id;
  }

  public get fullname(): string {
    return this.state.fullname;
  }

  public static ref(data: PersonData): Reference<Person> {
    return new APIItemReference(data.id, Person);
  }

  public ref(): Reference<Person> {
    return new APIItemReference(this.id, Person);
  }

  public static fromState(serverState: ServerState, item: MapId<Immutable<PersonData>>): Person {
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

    let user = serverState.user;
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
}

export class Album implements Referencable<Album> {
  private constructor(private readonly serverState: ServerState, private readonly state: Immutable<AlbumData>) {}

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
    let user = this.serverState.user;
    if (!user) {
      return [];
    }

    let catalogState: Immutable<CatalogData> | undefined = user.catalogs.get(this.state.catalog.id);

    if (!catalogState) {
      exception(ErrorCode.UnknownCatalog);
    }

    return Array.from(catalogState.albums.values())
      .filter((albumState: Immutable<AlbumData>): boolean => albumState.parent?.id == this.id)
      .map((albumState: Immutable<AlbumData>): Album => Album.fromState(this.serverState, albumState));
  }

  public isAncestorOf(album: Album): boolean {
    let parent = album.parent;
    while (parent) {
      if (parent == this) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  public static ref(data: AlbumData): Reference<Album> {
    return new APIItemReference(data.id, Album);
  }

  public ref(): Reference<Album> {
    return new APIItemReference(this.id, Album);
  }

  private static innerFromState(serverState: ServerState, item: MapId<Immutable<AlbumData>>): Album {
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

    let user = serverState.user;
    if (!user) {
      throw new InternalError(ErrorCode.NotLoggedIn);
    }

    for (let catalog of user.catalogs.values()) {
      let state = catalog.albums.get(id);
      if (state) {
        album = new Album(serverState, state);
        cache.albums.set(id, album);
        return album;
      }
    }

    throw new InternalError(ErrorCode.UnknownAlbum);
  }

  public static safeFromState(serverState: ServerState, item: MapId<Immutable<AlbumData>>): Album | undefined {
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
  private constructor(private readonly serverState: ServerState, private readonly state: Immutable<CatalogData>) {}

  public get id(): string {
    return this.state.id;
  }

  public get name(): string {
    return this.state.name;
  }

  public get rootAlbums(): Album[] {
    return Array.from(this.state.albums.values())
      .filter((album: Immutable<AlbumData>) => !album.parent)
      .map((album: Immutable<AlbumData>) => Album.fromState(this.serverState, album));
  }

  public findTag(path: string[]): Pending<Tag> {
    let pending = new PendingAPIItem(Tag);

    findTag(this.ref(), path).then(async (tags: TagData[]) => {
      const { asyncDispatch } = await import("../store");
      await asyncDispatch(tagsCreated(tags));
      pending.setId(tags[tags.length - 1].id);
    });

    return pending;
  }

  public get tags(): Tag[] {
    return Array.from(this.state.tags.values()).map((tag: Immutable<TagData>): Tag => Tag.fromState(this.serverState, tag));
  }

  public getAlbum(id: string): Album | undefined {
    let albumState = this.state.albums.get(id);
    if (albumState) {
      return Album.fromState(this.serverState, albumState);
    }
    return undefined;
  }

  public get albums(): Album[] {
    return Array.from(this.state.albums.values()).map((album: Immutable<AlbumData>): Album => Album.fromState(this.serverState, album));
  }

  public createPerson(fullname: string): Pending<Person> {
    let pending = new PendingAPIItem(Person);

    createPerson(this.ref(), fullname).then(async (person: PersonData) => {
      const { asyncDispatch } = await import("../store");
      await asyncDispatch(personCreated(person));
      pending.setId(person.id);
    });

    return pending;
  }

  public get people(): Person[] {
    return Array.from(this.state.people.values()).map((person: Immutable<PersonData>): Person => Person.fromState(this.serverState, person));
  }

  public static ref(data: CatalogData): Reference<Catalog> {
    return new APIItemReference(data.id, Catalog);
  }

  public ref(): Reference<Catalog> {
    return new APIItemReference(this.id, Catalog);
  }

  private static innerFromState(serverState: ServerState, item: MapId<Immutable<CatalogData>>): Catalog {
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

    let user = serverState.user;
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

  public static safeFromState(serverState: ServerState, item: MapId<Immutable<CatalogData>>): Catalog | undefined {
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
    return Array.from(serverState.user.catalogs.values(),
      (st: Immutable<CatalogData>) => Catalog.fromState(serverState, st));
  }
  return [];
}

