import React from "react";

import type { Api } from "../../model";
import { emptyMetadata, Method } from "../../model";
import { lastCallArgs, mockedFunction } from "../../test-helpers";
import { now } from "../../utils";
import { Catalog } from "../api/highlevel";
import MediaGallery from "../components/MediaGallery";
import { OverlayType } from "../overlays/types";
import {
  expect,
  mockStore,
  render,
  mockStoreState,
  mockServerState,
  expectChild,
  click,
  resetDOM,
  deferRequest,
} from "../test-helpers";
import { MediaLookupType } from "../utils/medialookup";
import CatalogPage from "./Catalog";
import { PageType } from "./types";

jest.mock("../api/api");
jest.mock("../components/MediaGallery", () => jest.fn(() => null));

beforeEach(resetDOM);

const mockedMediaGallery = mockedFunction(MediaGallery);

test("catalog", async (): Promise<void> => {
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

  let { call, resolve } = deferRequest<Api.Media[]>();

  let { container, rerender } = render(
    <CatalogPage user={store.state.serverState.user!} catalog={catalogRef}/>,
    store,
  );

  await expect(call).resolves.toEqual([
    Method.CatalogList,
    {
      id: "catalog",
    },
  ]);

  let buttons = expectChild(container, "#banner-buttons");

  expect(store.dispatch).not.toHaveBeenCalled();

  let button = expectChild(buttons, "#pageoption-button-album-create");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showOverlay",
    payload: [{
      type: OverlayType.AlbumCreate,
      parent: expect.toBeRef("catalog"),
    }],
  });
  store.dispatch.mockClear();

  expect(mockedMediaGallery).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedMediaGallery)[0]).toEqual({
    media: null,
    onClick: expect.anything(),
  });
  mockedMediaGallery.mockClear();

  let dt = now();
  let media = [{
    ...emptyMetadata,
    id: "media1",
    created: dt,
    updated: dt,
    albums: [],
    tags: [],
    people: [],
  }, {
    ...emptyMetadata,
    id: "media2",
    created: dt,
    updated: dt,
    albums: [],
    tags: [],
    people: [],
  }, {
    ...emptyMetadata,
    id: "media3",
    created: dt,
    updated: dt,
    albums: [],
    tags: [],
    people: [],
  }];

  await resolve(media);

  expect(mockedMediaGallery).toHaveBeenCalled();
  expect(lastCallArgs(mockedMediaGallery)[0]).toEqual({
    media,
    onClick: expect.anything(),
  });
  mockedMediaGallery.mockClear();

  let { call: call2, resolve: resolve2 } = deferRequest<Api.Media[]>();
  let wasCalled = false;
  void call2.then(() => wasCalled = true);

  rerender(<CatalogPage user={store.state.serverState.user!} catalog={catalogRef}/>);
  expect(store.dispatch).not.toHaveBeenCalled();
  expect(wasCalled).toBeFalsy();

  catalogRef = Catalog.ref("catalog2");
  rerender(<CatalogPage user={store.state.serverState.user!} catalog={catalogRef}/>);

  expect(store.dispatch).not.toHaveBeenCalled();

  await expect(call2).resolves.toEqual([
    Method.CatalogList,
    {
      id: "catalog2",
    },
  ]);

  media = [media[0]];
  await resolve2(media);

  expect(mockedMediaGallery).toHaveBeenCalled();
  expect(lastCallArgs(mockedMediaGallery)[0]).toEqual({
    media,
    onClick: expect.anything(),
  });
  // @ts-ignore
  lastCallArgs(mockedMediaGallery)[0].onClick({ id: "foo" });

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "navigate",
    payload: [{
      page: {
        type: PageType.Media,
        media: "foo",
        lookup: {
          type: MediaLookupType.Catalog,
          catalog: expect.toBeRef("catalog2"),
        },
      },
    }],
  });
});
