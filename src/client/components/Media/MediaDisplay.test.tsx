import { act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { emptyMetadata } from "../../../model";
import { deferCall, lastCallArgs, mockedFunction } from "../../../test-helpers";
import { now } from "../../../utils/datetime";
import { Catalog, Person } from "../../api/highlevel";
import { getMediaRelations } from "../../api/media";
import type { MediaState } from "../../api/types";
import {
  expect,
  render,
  mockStore,
  mockStoreState,
  mockServerState,
  expectChild,
  click,
} from "../../test-helpers";
import MediaDisplay from "./MediaDisplay";
import MediaInfo from "./MediaInfo";

jest.mock("./MediaInfo", () => jest.fn(() => null));
jest.mock("../../api/media", () => ({
  __esModule: true,
  getMediaRelations: jest.fn(),
}));

jest.useFakeTimers();

const mockedMediaInfo = mockedFunction(MediaInfo);
const mockedGetMediaRelations = mockedFunction(getMediaRelations);

test("media display", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
      people: [{
        id: "p1",
        name: "Bob",
      }],
    }]),
  }));

  let dt = now();

  let media: MediaState[] = [{
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
      uploaded: dt,
      url: "http://localhost/original.jpg",
      thumbnails: [],
      encodings: [{
        url: "http://localhost/alt.jpg",
        mimetype: "image/jpeg",
      }],
      videoEncodings: [],
    },
    id: "foo",
    created: dt,
    updated: dt,
  }];

  let onChangeMedia = jest.fn();
  let onCloseMedia = jest.fn();

  let { call, resolve } = deferCall(mockedGetMediaRelations);

  let { container } = render(
    <MediaDisplay
      media={media}
      selectedMedia="foo"
      onChangeMedia={onChangeMedia}
      onCloseMedia={onCloseMedia}
    />,
    store,
  );

  let ids = await call;
  expect(ids).toEqual([["foo"]]);

  await act(() => resolve([{
    albums: [],
    people: [{
      person: Person.ref("p1"),
      location: {
        left: 0.25,
        right: 0.6,
        top: 0.3,
        bottom: 0.7,
      },
    }],
    tags: [],
  }]));

  expect(mockedMediaInfo).not.toHaveBeenCalled();

  expect(container.querySelector("#close-button")).not.toBeNull();
  expect(container.querySelector("#prev-button")).toBeNull();
  expect(container.querySelector("#next-button")).toBeNull();

  let infoButton = expectChild(container, "#info-button");
  let enterFullscreen = expectChild(container, "#enter-fullscreen");
  expect(container.querySelector("#exit-fullscreen")).toBeNull();

  expect(expectChild(container, "#main-overlay")).not.toBeHidden();
  expect(expectChild(container, "#media-controls")).not.toBeHidden();

  act(() => jest.runAllTimers());

  expect(expectChild(container, "#main-overlay")).toBeHidden();
  expect(expectChild(container, "#media-controls")).toBeHidden();

  let display = expectChild(container, "#media-display");

  act(() => userEvent.hover(display));

  expect(expectChild(container, "#main-overlay")).not.toBeHidden();
  expect(expectChild(container, "#media-controls")).not.toBeHidden();

  let original = expectChild(container, "#media-fallback");
  expect(original.localName).toBe("img");
  expect(original.getAttribute("src")).toBe("http://localhost/alt.jpg");

  let fullscreenRequest = jest.fn()
    .mockReturnValue(Promise.resolve());
  display.requestFullscreen = fullscreenRequest;
  let fullscreenExit = jest.fn()
    .mockReturnValue(Promise.resolve());
  document.exitFullscreen = fullscreenExit;

  click(enterFullscreen);

  expect(fullscreenRequest).toHaveBeenCalledTimes(1);
  // @ts-ignore
  display.ownerDocument["fullscreenElement"] = display;

  let event = new window.Event("fullscreenchange");
  act(() => {
    fireEvent(display.ownerDocument, event);
  });

  let exitFullscreen = expectChild(container, "#exit-fullscreen");
  expect(container.querySelector("#enter-fullscreen")).toBeNull();

  click(exitFullscreen);

  expect(fullscreenExit).toHaveBeenCalledTimes(1);

  // @ts-ignore
  display.ownerDocument["fullscreenElement"] = null;

  event = new window.Event("fullscreenchange");
  act(() => {
    fireEvent(display.ownerDocument, event);
  });

  expect(container.querySelector("#enter-fullscreen")).not.toBeNull();
  expect(container.querySelector("#exit-fullscreen")).toBeNull();

  click(infoButton);

  expect(mockedMediaInfo).toHaveBeenCalled();
  expect(mockedMediaInfo).toHaveBeenLastCalledWith({
    media: {
      ...media[0],
      catalog: expect.toBeRef("catalog"),
    },
    relations: {
      albums: [],
      people: [{
        person: expect.toBeRef("p1"),
        location: {
          left: 0.25,
          right: 0.6,
          top: 0.3,
          bottom: 0.7,
        },
      }],
      tags: [],
    },
    onHighlightPerson: expect.anything(),
  }, {});

  let { onHighlightPerson } = lastCallArgs(mockedMediaInfo)[0];

  expect(display.querySelector(".face-highlight")).toBeNull();

  act(() => onHighlightPerson(Person.ref("p1")));

  let area = expectChild(display, ".face-highlight");
  let style = area.ownerDocument.defaultView?.getComputedStyle(area);
  expect(style?.left).toBe("25%");
  expect(style?.right).toBe("40%");
  expect(style?.top).toBe("30%");
  expect(style?.bottom).toBe("30%");

  act(() => onHighlightPerson(null));
  expect(display.querySelector(".face-highlight")).toBeNull();
});

test("multiple media page", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
    }]),
  }));

  let dt = now();

  let media: MediaState[] = [{
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
      uploaded: dt,
      url: "http://localhost/original.jpg",
      thumbnails: [{
        url: "http://localhost/100.jpg",
        mimetype: "image/jpeg",
        size: 100,
      }],
      encodings: [{
        url: "http://localhost/encoded.jpg",
        mimetype: "image/jpeg",
      }],
      videoEncodings: [],
    },
    id: "foo",
    created: dt,
    updated: dt,
  }, {
    ...emptyMetadata,
    catalog: Catalog.ref("catalog"),
    file: {
      id: "inn",
      fileSize: 2000,
      mimetype: "video/mp4",
      width: 500,
      height: 200,
      frameRate: null,
      bitRate: null,
      duration: null,
      uploaded: dt,
      url: "http://localhost/original.mp4",
      thumbnails: [{
        url: "http://localhost/100.jpg",
        mimetype: "image/jpeg",
        size: 100,
      }],
      encodings: [{
        url: "http://localhost/encoded.jpg",
        mimetype: "image/jpeg",
      }],
      videoEncodings: [],
    },
    id: "bar",
    created: dt,
    updated: dt,
  }];

  let onChangeMedia = jest.fn();
  let onCloseMedia = jest.fn();

  let { call, resolve } = deferCall(mockedGetMediaRelations);

  let { container, rerender } = render(
    <MediaDisplay
      media={media}
      selectedMedia="foo"
      onChangeMedia={onChangeMedia}
      onCloseMedia={onCloseMedia}
    />,
    store,
  );

  let ids = await call;
  expect(ids).toEqual([["foo"]]);
  await act(() => resolve([{
    albums: [],
    people: [],
    tags: [],
  }]));

  expect(mockedMediaInfo).not.toHaveBeenCalled();

  let closeButton = expectChild(container, "#close-button");
  expect(container.querySelector("#prev-button")).toBeNull();
  let nextButton = expectChild(container, "#next-button");

  click(closeButton);

  expect(store.dispatch).not.toHaveBeenCalled();
  expect(onCloseMedia).toHaveBeenCalledTimes(1);
  onCloseMedia.mockClear();

  click(nextButton);
  expect(onChangeMedia).toHaveBeenCalledTimes(1);
  onChangeMedia.mockClear();

  ({ call, resolve } = deferCall(mockedGetMediaRelations));

  rerender(<MediaDisplay
    media={media}
    selectedMedia="bar"
    onChangeMedia={onChangeMedia}
    onCloseMedia={onCloseMedia}
  />);

  ids = await call;
  expect(ids).toEqual([["bar"]]);
  await act(() => resolve([{
    albums: [],
    people: [],
    tags: [],
  }]));

  let prevButton = expectChild(container, "#prev-button");

  let original = expectChild(container, "#media-original");
  expect(original.localName).toBe("video");
  expect(original.getAttribute("poster")).toBe("http://localhost/encoded.jpg");

  let source = original.firstElementChild;
  expect(source?.localName).toBe("source");
  expect(source?.getAttribute("src")).toBe("http://localhost/original.mp4");

  click(prevButton);
  expect(onChangeMedia).toHaveBeenCalledTimes(1);
  onChangeMedia.mockClear();
});