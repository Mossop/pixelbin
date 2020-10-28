import type { Deed } from "deeds/immer";
import type { Draft } from "immer";
import type { Unsubscribe } from "redux";

import type { Query } from "../../model";
import { Operator, emptyMetadata } from "../../model";
import type { Overwrite } from "../../utils";
import { now } from "../../utils";
import type { Reference } from "../api/highlevel";
import { Catalog, Tag, Album } from "../api/highlevel";
import type {
  CatalogState,
  ServerState,
  PersonState,
  TagState,
  AlbumState,
  UnprocessedMediaState,
  ProcessedMediaState,
  StorageState,
  SavedSearchState,
} from "../api/types";
import { PageType } from "../pages/types";
import { provideService } from "../services";
import type { StoreState, StoreType } from "../store/types";
import type { MapOf } from "../utils/maps";
import { intoMap } from "../utils/maps";

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
type MockSavedSearch = Overwrite<Omit<SavedSearchState, "catalog">, {
  id?: string;
  query?: Query;
}>;
type MockCatalog = Overwrite<CatalogState, {
  storage?: MockStorage | string;
  id?: string;
  albums?: MockAlbum[];
  tags?: MockTag[];
  people?: MockPerson[];
  searches?: MockSavedSearch[];
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

    let {
      children,
      ...fields
    } = mock;

    yield {
      ...fields,
      id,
      catalog,
      parent,
    };

    yield* iterAlbums(catalog, ref, children);
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

    let {
      children,
      ...fields
    } = mock;

    yield {
      ...fields,
      id,
      catalog,
      parent,
    };

    yield* iterTags(catalog, ref, children);
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

function *iterSearches(
  catalog: Reference<Catalog>,
  mocks: MockSavedSearch[] | undefined,
): Iterable<Draft<SavedSearchState>> {
  if (!mocks) {
    return;
  }

  for (let mock of mocks) {
    let id = mock.id ?? randomId();
    let query = mock.query ?? {
      type: "field",
      invert: false,
      field: "title",
      modifier: null,
      operator: Operator.Equal,
      value: "foo",
    };

    yield {
      name: mock.name,
      id,
      catalog,
      query,
    } as Draft<SavedSearchState>;
  }
}

export function mockUnprocessedMedia(
  data: Partial<Draft<UnprocessedMediaState>>,
): Draft<UnprocessedMediaState> {
  let current = now();

  return {
    id: randomId(),
    created: current,
    updated: current,

    tags: [],
    albums: [],
    people: [],

    ...emptyMetadata,
    ...data,
  };
}

export function mockProcessedMedia(
  data: Partial<Draft<ProcessedMediaState>>,
): Draft<ProcessedMediaState> {
  let id = data.id ?? randomId();
  let current = now();

  return {
    id,
    created: current,
    updated: current,

    uploaded: current,
    width: 1024,
    height: 768,
    mimetype: "image/jpeg",
    fileSize: 1024,
    duration: null,
    bitRate: null,
    frameRate: null,
    thumbnailUrl: `http://localhost/media/thumbnail/${id}/${randomId()}`,
    originalUrl: `http://localhost/media/original/${id}/${randomId()}`,
    posterUrl: null,

    tags: [],
    albums: [],
    people: [],

    ...emptyMetadata,
    ...data,
  };
}

export function mockCatalog(mock: MockCatalog, storage: MapOf<StorageState>): Draft<CatalogState> {
  let id = mock.id ?? randomId();
  let ref = Catalog.ref(id);

  let buildStorage = (def: string | MockStorage | undefined): string => {
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
    searches: intoMap(iterSearches(ref, mock.searches)),
  };
}

export function mockStorage(mock: MockStorage): Draft<StorageState> {
  return {
    id: randomId(),
    name: "Test store",
    bucket: "test-bucket",
    region: "test-region-001",
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
        type: PageType.Root,
      },
    },
  };
}

export interface MockStore {
  state: Draft<StoreState>;
  dispatch: jest.MockedFunction<(action: Deed) => void>;
  subscribe: jest.MockedFunction<(cb: () => void) => Unsubscribe>;
  getState: () => StoreState;
}

let mockedStore: MockStore | null = null;
export function mockStore(initialState: Draft<StoreState>): MockStore {
  if (!mockedStore) {
    mockedStore = {
      state: initialState,
      dispatch: jest.fn<void, [Deed]>(),
      subscribe: jest.fn<Unsubscribe, [() => void]>(),
      getState(): StoreState {
        return this.state;
      },
    };

    provideService("store", mockedStore as unknown as StoreType);
  } else {
    mockedStore.state = initialState;
  }

  return mockedStore;
}
