import { Deed } from "deeds/immer";
import { Draft } from "immer";
import { Unsubscribe } from "redux";

import { Catalog, Reference, Tag, Album } from "../api/highlevel";
import { CatalogData, ServerData, PersonData, TagData, AlbumData } from "../api/types";
import { PageType } from "../pages/types";
import { StoreState } from "../store/types";
import { intoMap } from "../utils/maps";

type MockPerson = Omit<PersonData, "id" | "catalog"> & {
  id?: string;
};
type MockAlbum = Omit<AlbumData, "id" | "catalog" | "parent"> & {
  id?: string;
  children?: MockAlbum[];
};
type MockTag = Omit<TagData, "id" | "catalog" | "parent"> & {
  id?: string;
  children?: MockTag[];
};
type MockCatalog = Omit<CatalogData, "id" | "people" | "tags" | "albums"> & {
  id?: string;
  albums?: MockAlbum[];
  tags?: MockTag[];
  people?: MockPerson[];
};

export function randomId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function *iterAlbums(
  catalog: Reference<Catalog>,
  parent: Reference<Album> | null,
  mocks: MockAlbum[] | undefined,
): Iterable<Draft<AlbumData>> {
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
): Iterable<Draft<TagData>> {
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
): Iterable<Draft<PersonData>> {
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

export function mockCatalog(mock: MockCatalog): Draft<CatalogData> {
  let id = mock.id ?? randomId();
  let ref = Catalog.ref(id);

  return {
    ...mock,
    id,
    albums: intoMap(iterAlbums(ref, null, mock.albums)),
    people: intoMap(iterPeople(ref, mock.people)),
    tags: intoMap(iterTags(ref, null, mock.tags)),
  };
}

export function mockServerData(catalogs?: MockCatalog[]): Draft<ServerData> {
  if (catalogs === undefined) {
    catalogs = [];
  }

  return {
    user: {
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      hadCatalog: true,
      verified: true,
      catalogs: intoMap(catalogs.map(mockCatalog)),
    },
  };
}

export function mockStoreState(state?: Partial<Draft<StoreState>>): Draft<StoreState> {
  if (state === undefined) {
    state = {};
  }

  return {
    serverState: state.serverState ?? mockServerData(),
    settings: state.settings ?? {
      thumbnailSize: 150,
    },
    ui: state.ui ?? {
      page: {
        type: PageType.Index,
      },
    },
    stateId: 0,
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