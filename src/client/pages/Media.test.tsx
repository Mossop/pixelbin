import { act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { emptyMetadata, Method } from "../../model";
import { mockedFunction } from "../../test-helpers";
import { now } from "../../utils";
import MediaInfo from "../components/MediaInfo";
import {
  expect,
  render,
  mockStore,
  mockStoreState,
  mockServerState,
  deferRequest,
  expectChild,
  click,
} from "../test-helpers";
import MediaPage from "./Media";

jest.mock("../api/api");
jest.mock("../components/MediaInfo", () => jest.fn(() => null));

jest.useFakeTimers();

const mockedMediaInfo = mockedFunction(MediaInfo);

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
      thumbnailUrl: "http://localhost/thumb.jpg",
      originalUrl: "http://localhost/original.jpg",
      posterUrl: null,
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

  expect(container.querySelector("#prev-button")).toBeNull();
  expect(container.querySelector("#next-button")).toBeNull();

  let infoButton = expectChild(container, "#info-button");
  let enterFullscreen = expectChild(container, "#enter-fullscreen");
  expect(container.querySelector("#exit-fullscreen")).toBeNull();

  expect(container.querySelector(".hidden #main-overlay")).toBeNull();
  expect(container.querySelector(".visible #main-overlay")).not.toBeNull();
  expect(container.querySelector("#media-controls.hidden")).toBeNull();
  expect(container.querySelector("#media-controls.visible")).not.toBeNull();

  act(() => jest.runAllTimers());

  expect(container.querySelector(".hidden #main-overlay")).not.toBeNull();
  expect(container.querySelector(".visible #main-overlay")).toBeNull();
  expect(container.querySelector("#media-controls.hidden")).not.toBeNull();
  expect(container.querySelector("#media-controls.visible")).toBeNull();

  let display = expectChild(container, "#media-display");

  act(() => userEvent.hover(display));

  expect(container.querySelector(".hidden #main-overlay")).toBeNull();
  expect(container.querySelector(".visible #main-overlay")).not.toBeNull();
  expect(container.querySelector("#media-controls.hidden")).toBeNull();
  expect(container.querySelector("#media-controls.visible")).not.toBeNull();

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
});
