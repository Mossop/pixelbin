import React from "react";

import { lastCallArgs } from "../../test-helpers";
import { Catalog } from "../api/highlevel";
import { MediaLookupType } from "../store/types";
import {
  expect,
  mockStore,
  render,
  mockStoreState,
  mockServerState,
  expectChild,
  click,
  resetDOM,
} from "../test-helpers";
import CatalogPage from "./catalog";

beforeEach(resetDOM);

test("catalog", (): void => {
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

  let { container, rerender } = render(
    <CatalogPage user={store.state.serverState.user!} catalog={catalogRef}/>,
    store,
  );

  let buttons = expectChild(container, "#banner-buttons");

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "listMedia",
    payload: [{
      type: MediaLookupType.Catalog,
      catalog: expect.toBeRef("catalog"),
    }],
  });
  store.dispatch.mockClear();

  expect(store.dispatch).not.toHaveBeenCalled();
  let button = expectChild(buttons, "#pageoption-button-catalog-edit");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showCatalogEditOverlay",
    payload: [
      expect.toBeRef("catalog"),
    ],
  });
  store.dispatch.mockClear();

  button = expectChild(buttons, "#pageoption-button-album-create");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showAlbumCreateOverlay",
    payload: [
      expect.toBeRef("catalog"),
    ],
  });
  store.dispatch.mockClear();

  rerender(<CatalogPage user={store.state.serverState.user!} catalog={catalogRef}/>);
  expect(store.dispatch).not.toHaveBeenCalled();

  catalogRef = Catalog.ref("catalog2");
  rerender(<CatalogPage user={store.state.serverState.user!} catalog={catalogRef}/>);

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "listMedia",
    payload: [{
      type: MediaLookupType.Catalog,
      catalog: expect.toBeRef("catalog2"),
    }],
  });
  store.dispatch.mockClear();
});
