import React from "react";

import { lastCallArgs } from "../../test-helpers";
import { Catalog } from "../api/highlevel";
import {
  expect,
  mockStore,
  render,
  mockStoreState,
  mockServerState,
  expectChild,
  click,
} from "../test-helpers";
import CatalogPage from "./catalog";

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

  let { container } = render(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    <CatalogPage user={store.state.serverState.user!} catalog={catalogRef}/>,
    store,
  );

  let buttons = expectChild(container, "#banner-buttons");

  expect(store.dispatch).not.toHaveBeenCalled();
  let button = expectChild(buttons, "#button-banner-catalog-edit");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showCatalogEditOverlay",
    payload: [
      expect.toBeRef("catalog"),
    ],
  });
  store.dispatch.mockClear();

  button = expectChild(buttons, "#button-banner-album-create");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showAlbumCreateOverlay",
    payload: [
      expect.toBeRef("catalog"),
    ],
  });
  store.dispatch.mockClear();
});
