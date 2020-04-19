/* eslint-disable import/export */
import { ReactLocalization, LocalizationProvider } from "@fluent/react";
import { render as testRender, RenderOptions, Queries, RenderResult } from "@testing-library/react";
import React, { ReactNode, ReactElement } from "react";
import { Provider } from "react-redux";

import { Reference, Catalog, Album, Tag, isReference } from "../js/api/highlevel";
import { ServerData, AlbumData, CatalogData, TagData, PersonData } from "../js/api/types";
import store, { asyncDispatch } from "../js/store";
import actions from "../js/store/actions";
import { intoMap } from "../js/utils/maps";

expect.extend({
  toBeRef(received: unknown, id: string): jest.CustomMatcherResult {
    if (isReference(received) && received.id == id) {
      return {
        message: (): string => `expected ${received} not to be a reference with id ${id}`,
        pass: true,
      };
    } else {
      return {
        message: (): string => `expected ${received} to be a reference with id ${id}`,
        pass: false,
      };
    }
  },
});

type ExtendedExpect = jest.Expect & {
  toBeRef: (id: string) => void;
};

export const pxExpect = expect as ExtendedExpect;

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

function randomId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function *iterAlbums(
  catalog: Reference<Catalog>,
  parent: Reference<Album> | null,
  mocks: MockAlbum[] | undefined,
): Iterable<AlbumData> {
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
): Iterable<TagData> {
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
): Iterable<PersonData> {
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

function buildCatalog(mock: MockCatalog): CatalogData {
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

export function buildServerData(catalogs: MockCatalog[]): ServerData {
  return {
    user: {
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      hadCatalog: true,
      verified: true,
      catalogs: intoMap(catalogs.map(buildCatalog)),
    },
  };
}

export function expectElement(node: Node | null): Element {
  expect(node).not.toBeNull();
  expect(node?.nodeType).toBe(Node.ELEMENT_NODE);

  return node as Element;
}

function WrapComponent({ children }: { children?: ReactNode }): ReactElement | null {
  let l10n = new ReactLocalization([]);

  return <Provider store={store}>
    <LocalizationProvider l10n={l10n}>
      {children}
    </LocalizationProvider>
  </Provider>;
}

export * from "@testing-library/react";

export function render(ui: ReactElement, options?: Omit<RenderOptions, "queries">): RenderResult;
export function render<Q extends Queries>(
  ui: ReactElement,
  options: RenderOptions<Q>,
): RenderResult<Q>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function render(ui: any, options?: any): any {
  let results = testRender(ui, { wrapper: WrapComponent, ...options });
  return {
    ...results,
  };
}

export async function reset(): Promise<void> {
  await asyncDispatch(actions.completeLogout({
    user: null,
  }));

  while (document.head.firstChild) {
    document.head.firstChild.remove();
  }

  while (document.body.firstChild) {
    document.body.firstChild.remove();
  }
}
