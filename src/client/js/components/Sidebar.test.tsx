/* eslint-disable @typescript-eslint/naming-convention */
import React from "react";

import { Album } from "../api/highlevel";
import { PageType } from "../pages/types";
import {
  expect,
  click,
  mockStore,
  mockStoreState,
  mockServerState,
  render,
  expectChild,
  expectElement,
} from "../test-helpers";
import Sidebar from "./Sidebar";

jest.mock("./Button");

test("sidebar", (): void => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
      albums: [{
        id: "album1_1",
        name: "Album 1",
      }],
    }, {
      id: "catalog2",
      name: "Catalog 2",
      albums: [{
        id: "album2_1",
        name: "Album 2",
      }, {
        id: "album2_2",
        name: "Album 3",
        children: [{
          id: "album2_2_1",
          name: "Album 5",
        }, {
          id: "album2_2_2",
          name: "Album 6",
        }],
      }, {
        id: "album2_3",
        name: "Album 4",
      }],
    }]),
  }));

  let album = Album.fromState(store.state.serverState, "album2_2");
  let { container } = render(<Sidebar selectedItem={album}/>, store);
  let catalogs = expectChild(container, "#catalog-tree");

  let button = expectChild(catalogs, "#new-catalog");
  click(button);
  expect(store.dispatch.mock.calls).toEqual([[{
    type: "showCatalogCreateOverlay",
    payload: [],
  }]]);
  store.dispatch.mockClear();

  let tree = expectChild(catalogs, "ol.site-tree");
  expect(tree.childElementCount).toBe(2);

  let cat1 = expectElement(tree.firstElementChild);
  expect(cat1.localName).toBe("li");
  expect(cat1.classList).toContain("depth0");

  button = expectChild(cat1, ".depth0 > .mock-button");
  expect(button.classList).toContain("item");
  expect(button.classList).toContain("catalog");
  expect(button.getAttribute("data-icon")).toBe("archive");
  expect(button.textContent).toBe("Catalog");

  click(button);
  expect(store.dispatch.mock.calls).toEqual([[{
    type: "navigate",
    payload: [{
      page: {
        type: PageType.Catalog,
        catalog: expect.toBeRef("catalog"),
      },
    }],
  }]]);
  store.dispatch.mockClear();

  let children = expectChild(cat1, ".depth0 > ol");
  expect(children.childElementCount).toBe(1);

  let virtual = expectElement(children.firstElementChild);
  let item = expectChild(virtual, ".depth1 > p");
  expect(item.classList).toContain("item");
  expect(item.classList).toContain("albums");
  expect(item.textContent).toBe("catalog-albums");
  expectChild(item, ".icon.fa-folder");

  children = expectChild(virtual, ".depth1 > ol");
  expect(children.childElementCount).toBe(1);

  let album1_1 = expectElement(children.firstElementChild);
  expect(album1_1.localName).toBe("li");
  expect(album1_1.classList).toContain("depth2");

  button = expectChild(album1_1, ".depth2 > .mock-button");
  expect(button.classList).toContain("item");
  expect(button.classList).toContain("album");
  expect(button.getAttribute("data-icon")).toBe("images");
  expect(button.textContent).toBe("Album 1");

  click(button);
  expect(store.dispatch.mock.calls).toEqual([[{
    type: "navigate",
    payload: [{
      page: {
        type: PageType.Album,
        album: expect.toBeRef("album1_1"),
      },
    }],
  }]]);
  store.dispatch.mockClear();

  expect(album1_1.querySelector("ol")).toBeNull();
});
