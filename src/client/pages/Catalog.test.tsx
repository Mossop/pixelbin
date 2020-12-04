import React from "react";

import { emptyMetadata, Join } from "../../model";
import { lastCallArgs, mockedFunction } from "../../test-helpers";
import { now } from "../../utils";
import { Catalog } from "../api/highlevel";
import MediaListPage from "../components/Media/MediaListPage";
import { DialogType } from "../dialogs/types";
import {
  expect,
  mockStore,
  render,
  mockStoreState,
  mockServerState,
  resetDOM,
} from "../test-helpers";
import { MediaLookupType } from "../utils/medialookup";
import CatalogPage from "./Catalog";
import { PageType } from "./types";

jest.mock("../components/Media/MediaListPage");

beforeEach(resetDOM);

const mockedMediaListPage = mockedFunction(MediaListPage);
mockedMediaListPage.mockReturnValue(null);

test("catalog page", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
    }, {
      id: "catalog2",
      name: "Catalog 2",
    }]),
  }));

  let catalogRef = Catalog.ref("catalog");

  let { rerender } = render(
    <CatalogPage user={store.state.serverState.user!} catalog={catalogRef}/>,
    store,
  );

  expect(mockedMediaListPage).toHaveBeenCalled();

  let pageProps = lastCallArgs(mockedMediaListPage)[0];

  expect(pageProps.lookup).toEqual({
    type: MediaLookupType.Catalog,
    catalog: expect.toBeRef("catalog"),
  });
  expect(pageProps.selectedMedia).toBeUndefined();
  expect(pageProps.selectedItem).toBe("catalog");

  expect(store.dispatch).not.toHaveBeenCalled();

  let dt = now();
  let media = {
    ...emptyMetadata,
    catalog: Catalog.ref("catalog"),
    file: null,
    id: "media1",
    created: dt,
    updated: dt,
    albums: [],
    tags: [],
    people: [],
  };

  pageProps.onMediaClick(media);

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "navigate",
    payload: [{
      page: {
        type: PageType.Catalog,
        catalog: expect.toBeRef("catalog"),
        selectedMedia: "media1",
      },
    }],
  });

  store.dispatch.mockClear();

  rerender(<CatalogPage
    user={store.state.serverState.user!}
    catalog={catalogRef}
    selectedMedia="media1"
  />);

  pageProps = lastCallArgs(mockedMediaListPage)[0];

  expect(pageProps.lookup).toEqual({
    type: MediaLookupType.Catalog,
    catalog: expect.toBeRef("catalog"),
  });
  expect(pageProps.selectedMedia).toBe("media1");
  expect(pageProps.selectedItem).toBe("catalog");

  expect(store.dispatch).not.toHaveBeenCalled();

  pageProps.onCloseMedia();

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "navigate",
    payload: [{
      page: {
        type: PageType.Catalog,
        catalog: expect.toBeRef("catalog"),
      },
    }],
  });
  store.dispatch.mockClear();

  expect(pageProps.pageOptions).toHaveLength(3);
  let pageOptions = pageProps.pageOptions!;
  expect(pageOptions[0].label).toBe("banner-search");
  expect(pageOptions[1].label).toBe("banner-album-new");
  expect(pageOptions[2].label).toBe("banner-catalog-edit");

  pageOptions[0].onClick();
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "showDialog",
    payload: [{
      type: DialogType.Search,
      catalog: expect.toBeRef("catalog"),
      query: {
        invert: false,
        type: "compound",
        join: Join.And,
        queries: [],
      },
    }],
  });
  store.dispatch.mockClear();

  pageOptions[1].onClick();
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "showDialog",
    payload: [{
      type: DialogType.AlbumCreate,
      parent: expect.toBeRef("catalog"),
    }],
  });
  store.dispatch.mockClear();

  pageOptions[2].onClick();
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "showDialog",
    payload: [{
      type: DialogType.CatalogEdit,
      catalog: expect.toBeRef("catalog"),
    }],
  });
  store.dispatch.mockClear();
});
