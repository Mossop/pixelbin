import userEvent from "@testing-library/user-event";
import React from "react";

import { emptyMetadata, Join, Operator, RelationType } from "../../../model";
import { parseDateTime } from "../../../utils";
import { Album, Catalog, Person, Tag } from "../../api/highlevel";
import type { ProcessedMediaState } from "../../api/types";
import {
  render,
  mockStore,
  mockStoreState,
  mockServerState,
  expectChild,
  click,
  expect,
} from "../../test-helpers";
import { PageType } from "../types";
import MediaInfo from "./MediaInfo";

test("Mediainfo", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",

      tags: [{
        id: "t1",
        name: "biz",
      }, {
        id: "t2",
        name: "baz",
      }, {
        id: "t3",
        name: "buzz",
      }],

      albums: [{
        id: "a1",
        name: "Album 1",
      }, {
        id: "a2",
        name: "Album 2",
        children: [{
          id: "a3",
          name: "Album 3",
        }],
      }],

      people: [{
        id: "p1",
        name: "Someone",
      }, {
        id: "p2",
        name: "Buzz Bazz",
      }],
    }]),
  }));

  let taken = parseDateTime("2020-02-03T05:06:06Z");
  let created = parseDateTime("2020-11-10T00:00:00Z");

  let media: ProcessedMediaState = {
    ...emptyMetadata,
    catalog: Catalog.ref("catalog"),

    file: {
      id: "inn",
      fileSize: 2000,
      mimetype: "image/jpeg",
      width: 500,
      height: 200,
      frameRate: null,
      bitRate: null,
      duration: null,
      uploaded: created,
      originalUrl: "http://localhost/original.jpg",
      thumbnails: [],
      posters: [],
      alternatives: [],
    },
    id: "foo",
    created: created,
    updated: created,

    albums: [{
      album: Album.ref("a1"),
    }, {
      album: Album.ref("a3"),
    }],
    tags: [{
      tag: Tag.ref("t2"),
    }, {
      tag: Tag.ref("t3"),
    }],
    people: [{
      person: Person.ref("p1"),
      location: null,
    }, {
      person: Person.ref("p2"),
      location: {
        top: 0.2,
        bottom: 0.7,
        left: 0.3,
        right: 0.4,
      },
    }],

    taken,
    city: "Portland",
    photographer: "Dave Townsend",
    aperture: 1.8,
    shutterSpeed: "1/250",
    iso: 100.3,
    title: "Hello",
  };

  let onHighlightRegion = jest.fn();

  let { container } = render(<MediaInfo
    media={media}
    onHighlightRegion={onHighlightRegion}
  />, store);

  let tag = expectChild(container, "#tag-t2");
  expect(container.querySelector("#tag-t1")).toBeNull();
  expect(container.querySelector("#tag-t3")).not.toBeNull();

  click(tag.firstElementChild!);

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "navigate",
    payload: [{
      page: {
        type: PageType.Search,
        catalog: expect.toBeRef("catalog"),
        query: {
          invert: false,
          type: "compound",
          join: Join.And,
          relation: RelationType.Tag,
          recursive: false,
          queries: [{
            invert: false,
            type: "field",
            field: "id",
            modifier: null,
            operator: Operator.Equal,
            value: "t2",
          }],
        },
      },
    }],
  });
  store.dispatch.mockClear();

  let album = expectChild(container, "#album-a1");
  expect(container.querySelector("#album-a2")).toBeNull();
  expect(container.querySelector("#album-a3")).not.toBeNull();

  click(album.firstElementChild!);

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "navigate",
    payload: [{
      page: {
        type: PageType.Album,
        album: expect.toBeRef("a1"),
      },
    }],
  });
  store.dispatch.mockClear();

  let person = expectChild(container, "#person-p1");
  expect(onHighlightRegion).not.toHaveBeenCalled();
  userEvent.hover(person);
  expect(onHighlightRegion).toHaveBeenCalled();
  expect(onHighlightRegion).toHaveBeenLastCalledWith(null);

  userEvent.unhover(person);
  expect(onHighlightRegion).toHaveBeenLastCalledWith(null);

  onHighlightRegion.mockClear();

  person = expectChild(container, "#person-p2");

  userEvent.hover(person);
  expect(onHighlightRegion).toHaveBeenCalled();
  expect(onHighlightRegion).toHaveBeenLastCalledWith({
    top: 0.2,
    bottom: 0.7,
    left: 0.3,
    right: 0.4,
  });

  userEvent.unhover(person);
  expect(onHighlightRegion).toHaveBeenLastCalledWith(null);

  click(person.firstElementChild!);

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "navigate",
    payload: [{
      page: {
        type: PageType.Search,
        catalog: expect.toBeRef("catalog"),
        query: {
          invert: false,
          type: "compound",
          join: Join.And,
          relation: RelationType.Person,
          recursive: false,
          queries: [{
            invert: false,
            type: "field",
            field: "id",
            modifier: null,
            operator: Operator.Equal,
            value: "p2",
          }],
        },
      },
    }],
  });
  store.dispatch.mockClear();

  let value = expectChild(container, ".metadata-photographer.metadata-value");
  expect(value.textContent).toBe("Dave Townsend");

  value = expectChild(container, ".metadata-location.metadata-value");
  expect(value.textContent).toBe("Portland");

  value = expectChild(container, ".metadata-aperture.metadata-value");
  expect(value.textContent).toBe("f/1.8");

  value = expectChild(container, ".metadata-shutterSpeed.metadata-value");
  expect(value.textContent).toBe("\u00B9\u2044\u2082\u2085\u2080 s");

  value = expectChild(container, ".metadata-iso.metadata-value");
  expect(value.textContent).toBe("ISO 100");

  value = expectChild(container, ".metadata-title.metadata-value");
  expect(value.textContent).toBe("Hello");
});
