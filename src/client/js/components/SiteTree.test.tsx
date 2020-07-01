/* eslint-disable @typescript-eslint/naming-convention */
import React from "react";

import { lastCallArgs } from "../../../test-helpers";
import { Album, Reference, Catalog } from "../api/highlevel";
import { MediaTarget } from "../api/media";
import {
  expect,
  click,
  mockStore,
  mockStoreState,
  mockServerData,
  render,
  expectChild,
  expectElement,
} from "../test-helpers";
import { Property } from "../utils/StateProxy";
import { MediaTargetSelector } from "./SiteTree";

jest.mock("./Button");

test("media target selector", (): void => {
  let store = mockStore(mockStoreState({
    serverState: mockServerData([{
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

  let setter = jest.fn();
  let property: Property<Reference<MediaTarget> | undefined> = {
    get: (): Reference<MediaTarget> | undefined => Album.ref("album2_1"),
    set: setter,
  };

  let { container } = render(<MediaTargetSelector property={property}/>, store);
  let tree = expectChild(container, "ol.site-tree");
  expect(tree.childElementCount).toBe(2);

  let cat1 = expectElement(tree.firstElementChild);
  expect(cat1.localName).toBe("li");
  expect(cat1.classList).toContain("depth0");

  let button = expectChild(cat1, ".depth0 > .mock-button");
  expect(button.classList).toContain("item");
  expect(button.classList).toContain("catalog");
  expect(button.getAttribute("data-icon")).toBe("archive");
  expect(button.textContent).toBe("Catalog");

  let albums = expectChild(cat1, ".depth0 > ol");
  expect(albums.childElementCount).toBe(1);

  let album1_1 = expectElement(albums.firstElementChild);
  expect(album1_1.localName).toBe("li");
  expect(album1_1.classList).toContain("depth1");

  button = expectChild(album1_1, ".depth1 > .mock-button");
  expect(button.classList).toContain("item");
  expect(button.classList).toContain("album");
  expect(button.getAttribute("data-icon")).toBe("images");
  expect(button.textContent).toBe("Album 1");

  expect(album1_1.querySelector("ol")).toBeNull();

  let cat2 = expectElement(cat1.nextElementSibling);
  expect(cat2.localName).toBe("li");
  expect(cat2.classList).toContain("depth0");

  albums = expectChild(cat2, ".depth0 > ol");
  expect(albums.childElementCount).toBe(3);

  let album2_1 = expectElement(albums.firstElementChild);
  expect(album2_1.localName).toBe("li");
  expect(album2_1.classList).toContain("depth1");

  let item = expectChild(album2_1, ".depth1 > p");
  expect(item.classList).toContain("item");
  expect(item.classList).toContain("album");
  expectChild(item, ".icon.fa-images");
  expect(item.textContent).toBe("Album 2");

  expect(album2_1.querySelector("ol")).toBeNull();

  let album2_2 = expectElement(album2_1.nextElementSibling);
  expect(album2_2.localName).toBe("li");

  let list = expectChild(album2_2, ".depth1 > ol");
  expect(list.childElementCount).toBe(2);

  let album2_2_2 = expectElement(list.lastElementChild);
  expect(album2_2_2.localName).toBe("li");
  expect(album2_2_2.classList).toContain("depth2");

  expect(album2_2_2.querySelector("ol")).toBeNull();

  button = expectChild(album2_2_2, ".depth2 > .mock-button");
  expect(button.classList).toContain("item");
  expect(button.classList).toContain("album");
  expect(button.textContent).toBe("Album 6");

  expect(setter).not.toHaveBeenCalled();
  click(button);
  expect(setter).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(setter)[0]).toBeRef("album2_2_2");
});

test("inner media target selector", (): void => {
  let store = mockStore(mockStoreState({
    serverState: mockServerData([{
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

  let setter = jest.fn();
  let property: Property<Reference<MediaTarget> | undefined> = {
    get: (): Reference<MediaTarget> | undefined => undefined,
    set: setter,
  };

  let catalog = Catalog.fromState(store.state.serverState, "catalog2");

  let { container } = render(
    <MediaTargetSelector roots={catalog.rootAlbums} property={property}/>,
    store,
  );
  let tree = expectChild(container, "ol.site-tree");
  expect(tree.childElementCount).toBe(3);

  let album2_1 = expectElement(tree.firstElementChild);
  expect(album2_1.localName).toBe("li");
  expect(album2_1.classList).toContain("depth0");

  let button = expectChild(album2_1, ".depth0 > .mock-button");
  expect(button.classList).toContain("item");
  expect(button.classList).toContain("album");
  expect(button.textContent).toBe("Album 2");

  expect(album2_1.querySelector("ol")).toBeNull();

  let album2_2 = expectElement(album2_1.nextElementSibling);
  expect(album2_2.localName).toBe("li");

  let list = expectChild(album2_2, ".depth0 > ol");
  expect(list.childElementCount).toBe(2);
});
