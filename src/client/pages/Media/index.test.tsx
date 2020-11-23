import { act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import MediaPage from ".";
import { emptyMetadata, Method } from "../../../model";
import { lastCallArgs, mockedFunction } from "../../../test-helpers";
import { now } from "../../../utils";
import { request } from "../../api/api";
import { Catalog } from "../../api/highlevel";
import {
  expect,
  render,
  mockStore,
  mockStoreState,
  mockServerState,
  deferRequest,
  expectChild,
  click,
} from "../../test-helpers";
import type { CatalogMediaLookup } from "../../utils/medialookup";
import { MediaLookupType } from "../../utils/medialookup";
import { PageType } from "../types";
import MediaInfo from "./MediaInfo";

jest.mock("../../api/api");
jest.mock("./MediaInfo", () => jest.fn(() => null));

jest.useFakeTimers();

const mockedMediaInfo = mockedFunction(MediaInfo);
const mockedRequest = mockedFunction(request);

test("single media page", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
    }]),
  }));

  let { call, resolve } = deferRequest<Method.MediaGet>();

  let { container } = render(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    <MediaPage user={store.state.serverState.user!} media="foo" lookup={null}/>,
    store,
  );

  expectChild(container, ".loading");
  expectChild(document, "#menu-button");
  expect(mockedMediaInfo).not.toHaveBeenCalled();

  await expect(call).resolves.toEqual([
    Method.MediaGet,
    {
      id: "foo",
    },
  ]);

  let dt = now();

  let media = [{
    ...emptyMetadata,
    catalog: "catalog",
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
      originalUrl: "http://localhost/original.jpg",
      thumbnails: [],
      alternatives: [],
    },
    id: "foo",
    created: dt,
    updated: dt,
    albums: [],
    tags: [],
    people: [],
  }];

  await resolve(media);

  expect(container.querySelector(".loading")).toBeNull();
  expect(mockedMediaInfo).not.toHaveBeenCalled();

  expect(container.querySelector("#back-button")).toBeNull();
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

  let original = expectChild(container, "#media-original");
  expect(original.localName).toBe("img");
  expect(original.getAttribute("src")).toBe("http://localhost/original.jpg");

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
    onHighlightRegion: expect.anything(),
  }, {});

  let { onHighlightRegion } = lastCallArgs(mockedMediaInfo)[0];

  expect(display.querySelector("#person-area")).toBeNull();

  act(() => onHighlightRegion({
    left: 0.25,
    right: 0.6,
    top: 0.3,
    bottom: 0.7,
  }));

  let area = expectChild(display, "#person-area");
  let style = area.ownerDocument.defaultView?.getComputedStyle(area);
  expect(style?.left).toBe("25%");
  expect(style?.right).toBe("40%");
  expect(style?.top).toBe("30%");
  expect(style?.bottom).toBe("30%");

  act(() => onHighlightRegion(null));
  expect(display.querySelector("person-area")).toBeNull();
});

test("multiple media page", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
    }]),
  }));

  let { call, resolve } = deferRequest<Method.CatalogList>();
  let lookup: CatalogMediaLookup = {
    type: MediaLookupType.Catalog,
    catalog: Catalog.ref("catalog"),
  };

  let { container, rerender } = render(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    <MediaPage user={store.state.serverState.user!} media="foo" lookup={lookup}/>,
    store,
  );

  expectChild(container, ".loading");
  expectChild(document, "#menu-button");
  expect(mockedMediaInfo).not.toHaveBeenCalled();

  await expect(call).resolves.toEqual([
    Method.CatalogList,
    {
      id: "catalog",
    },
  ]);

  let dt = now();

  let media = [{
    ...emptyMetadata,
    catalog: "catalog",
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
      originalUrl: "http://localhost/original.jpg",
      thumbnails: [],
      alternatives: [],
    },
    id: "foo",
    created: dt,
    updated: dt,
    albums: [],
    tags: [],
    people: [],
  }, {
    ...emptyMetadata,
    catalog: "catalog",
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
      originalUrl: "http://localhost/original.mp4",
      thumbnails: [],
      alternatives: [{
        url: "http://localhost/alternate.jpg",
        id: "post",
        fileSize: 1000,
        mimetype: "image/jpg",
        width: 500,
        height: 200,
        frameRate: null,
        bitRate: null,
        duration: null,
      }],
    },
    id: "bar",
    created: dt,
    updated: dt,
    albums: [],
    tags: [],
    people: [],
  }];

  await resolve(media);

  expect(container.querySelector(".loading")).toBeNull();
  expect(mockedMediaInfo).not.toHaveBeenCalled();

  let backButton = expectChild(container, "#back-button");
  expect(container.querySelector("#prev-button")).toBeNull();
  let nextButton = expectChild(container, "#next-button");

  expect(store.dispatch).not.toHaveBeenCalled();

  mockedRequest.mockImplementation(() => {
    throw new Error("Bad");
  });
  mockedRequest.mockClear();

  click(backButton);

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

  click(nextButton);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "navigate",
    payload: [{
      page: {
        type: PageType.Media,
        media: "bar",
        lookup,
      },
    }],
  });

  store.dispatch.mockClear();

  rerender(<MediaPage user={store.state.serverState.user!} media="bar" lookup={lookup}/>);

  expect(container.querySelector(".loading")).toBeNull();
  expect(container.querySelector("#next-button")).toBeNull();
  let prevButton = expectChild(container, "#prev-button");

  let original = expectChild(container, "#media-original");
  expect(original.localName).toBe("video");
  expect(original.getAttribute("poster")).toBe("http://localhost/alternate.jpg");

  let source = original.firstElementChild;
  expect(source?.localName).toBe("source");
  expect(source?.getAttribute("src")).toBe("http://localhost/original.mp4");

  expect(mockedRequest).not.toHaveBeenCalled();

  click(prevButton);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "navigate",
    payload: [{
      page: {
        type: PageType.Media,
        media: "foo",
        lookup,
      },
    }],
  });
});
