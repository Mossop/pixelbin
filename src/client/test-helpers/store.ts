import { Deed } from "deeds/immer";
import { Draft } from "immer";
import moment from "moment-timezone";
import { Unsubscribe } from "redux";

import { emptyMetadata } from "../../model";
import { Overwrite } from "../../utils";
import { Catalog, Reference, Tag, Album } from "../api/highlevel";
import {
  CatalogState,
  ServerState,
  PersonState,
  TagState,
  AlbumState,
  UnprocessedMediaState,
  ProcessedMediaState,
  StorageState,
} from "../api/types";
import { PageType } from "../pages/types";
import { StoreState } from "../store/types";
import { intoMap, MapOf } from "../utils/maps";

type MockStorage = Partial<StorageState>;
type MockPerson = Overwrite<Omit<PersonState, "catalog">, {
  id?: string;
}>;
type MockAlbum = Overwrite<Omit<AlbumState, "catalog" | "parent">, {
  id?: string;
  children?: MockAlbum[];
}>;
type MockTag = Overwrite<Omit<TagState, "catalog" | "parent">, {
  id?: string;
  children?: MockTag[];
}>;
type MockCatalog = Overwrite<CatalogState, {
  storage?: MockStorage | string;
  id?: string;
  albums?: MockAlbum[];
  tags?: MockTag[];
  people?: MockPerson[];
}>;

export function randomId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function *iterAlbums(
  catalog: Reference<Catalog>,
  parent: Reference<Album> | null,
  mocks: MockAlbum[] | undefined,
): Iterable<Draft<AlbumState>> {
  if (!mocks) {
    return;
  }

  for (let mock of mocks) {
    let id = mock.id ?? randomId();
    let ref = Album.ref(id);

    yield {
      ...mock,
      id,
      catalog,
      parent,
    };

    yield* iterAlbums(catalog, ref, mock.children);
  }
}

function *iterTags(
  catalog: Reference<Catalog>,
  parent: Reference<Tag> | null,
  mocks: MockTag[] | undefined,
): Iterable<Draft<TagState>> {
  if (!mocks) {
    return;
  }

  for (let mock of mocks) {
    let id = mock.id ?? randomId();
    let ref = Tag.ref(id);

    yield {
      ...mock,
      id,
      catalog,
      parent,
    };

    yield* iterTags(catalog, ref, mock.children);
  }
}

function *iterPeople(
  catalog: Reference<Catalog>,
  mocks: MockPerson[] | undefined,
): Iterable<Draft<PersonState>> {
  if (!mocks) {
    return;
  }

  for (let mock of mocks) {
    let id = mock.id ?? randomId();

    yield {
      ...mock,
      id,
      catalog,
    };
  }
}

export function mockUnprocessedMedia(
  data: Partial<Draft<UnprocessedMediaState>>,
): Draft<UnprocessedMediaState> {
  return {
    id: randomId(),
    created: moment().utc(),

    tags: [],
    albums: [],
    people: [],

    ...emptyMetadata(),
    ...data,
  };
}

export function mockProcessedMedia(
  data: Partial<Draft<ProcessedMediaState>>,
): Draft<ProcessedMediaState> {
  let id = data.id ?? randomId();

  return {
    id,
    created: moment().utc(),

    uploaded: moment().utc(),
    width: 1024,
    height: 768,
    mimetype: "image/jpeg",
    fileSize: 1024,
    duration: null,
    bitRate: null,
    frameRate: null,
    thumbnailUrl: `http://localhost/media/thumbnail/${id}/${randomId()}`,

    tags: [],
    albums: [],
    people: [],

    ...emptyMetadata(),
    ...data,
  };
}

export function mockCatalog(mock: MockCatalog, storage: MapOf<StorageState>): Draft<CatalogState> {
  let id = mock.id ?? randomId();
  let ref = Catalog.ref(id);

  const buildStorage = (def: string | MockStorage | undefined): string => {
    if (typeof def == "object") {
      let store = mockStorage(def);
      storage.set(store.id, store);
      return store.id;
    }

    if (def) {
      let store = storage.get(def);
      if (!store) {
        store = mockStorage({
          id: def,
        });
        storage.set(store.id, store);
      }
      return store.id;
    }

    let store = mockStorage({});
    storage.set(store.id, store);
    return store.id;
  };

  return {
    id: randomId(),

    ...mock,

    storage: buildStorage(mock.storage),

    albums: intoMap(iterAlbums(ref, null, mock.albums)),
    people: intoMap(iterPeople(ref, mock.people)),
    tags: intoMap(iterTags(ref, null, mock.tags)),
  };
}

export function mockStorage(mock: MockStorage): Draft<StorageState> {
  return {
    id: randomId(),
    name: "Test store",
    bucket: "test-bucket",
    path: null,
    endpoint: null,
    publicUrl: null,

    ...mock,
  };
}

export function mockServerState(catalogs?: MockCatalog[]): Draft<ServerState> {
  if (catalogs === undefined) {
    catalogs = [];
  }

  let storage: MapOf<Draft<StorageState>> = new Map();
  let catalogMap = intoMap(catalogs.map(
    (mock: MockCatalog): Draft<CatalogState> => mockCatalog(mock, storage),
  ));

  return {
    user: {
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      created: "2020-04-05T12:34:45Z",
      verified: true,
      storage,
      catalogs: catalogMap,
    },
  };
}

export function mockStoreState(state?: Partial<Draft<StoreState>>): Draft<StoreState> {
  if (state === undefined) {
    state = {};
  }

  return {
    serverState: state.serverState ?? mockServerState(),
    settings: state.settings ?? {
      thumbnailSize: 150,
    },
    ui: state.ui ?? {
      page: {
        type: PageType.Index,
      },
    },
    mediaList: null,
  };
}

export interface MockStore {
  state: Draft<StoreState>;
  dispatch: jest.MockedFunction<(action: Deed) => void>;
  subscribe: jest.MockedFunction<(cb: () => void) => Unsubscribe>;
  getState: () => StoreState;
}

export function mockStore(initialState: Draft<StoreState>): MockStore {
  return {
    state: initialState,
    dispatch: jest.fn<void, [Deed]>(),
    subscribe: jest.fn<Unsubscribe, [() => void]>(),
    getState(): StoreState {
      return this.state;
    },
  };
}
