import { buildStore } from ".";
import type { Api, ApiSerialization } from "../../model";
import { decode } from "../../utils";
import { StateDecoder } from "../api/decoders";
import { serverStateIntoState } from "../api/types";
import { PageType } from "../pages/types";
import services from "../services";
import { expect } from "../test-helpers";
import actions from "./actions";

test("store initialization", async (): Promise<void> => {
  buildStore();

  let store = await services.store;
  expect(store.getState()).toEqual({
    serverState: { user: null },
    settings: {
      thumbnailSize: 150,
    },
    ui: {
      page: {
        type: PageType.Root,
      },
    },
  });

  let serverState: ApiSerialization<Api.State> = {
    user: {
      administrator: false,
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      created: "2017-10-23T23:34:21Z",
      lastLogin: "2019-10-20T02:03:04Z",
      verified: true,
      storage: [],
      catalogs: [],
      albums: [],
      people: [],
      tags: [],
      searches: [],
    },
    apiHost: null,
  };

  store.dispatch(
    actions.updateServerState(serverStateIntoState(decode(StateDecoder, serverState))),
  );

  expect(store.getState()).toEqual({
    serverState: {
      user: {
        email: "dtownsend@oxymoronical.com",
        fullname: "Dave Townsend",
        administrator: false,
        created: expect.toEqualDate("2017-10-23T23:34:21Z"),
        lastLogin: expect.toEqualDate("2019-10-20T02:03:04Z"),
        verified: true,
        storage: new Map(),
        catalogs: new Map(),
      },
    },
    settings: {
      thumbnailSize: 150,
    },
    ui: {
      page: {
        type: PageType.Root,
      },
    },
  });
});
