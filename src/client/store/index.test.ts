import { buildStore } from ".";
import { Api, ResponseFor } from "../../model";
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
        type: PageType.Index,
      },
    },
  });

  let serverState: ResponseFor<Api.State> = {
    user: {
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      created: "2017-10-23T23:34:21Z",
      verified: true,
      storage: [],
      catalogs: [],
      albums: [],
      people: [],
      tags: [],
      searches: [],
    },
  };

  store.dispatch(
    actions.updateServerState(serverStateIntoState(decode(StateDecoder, serverState))),
  );

  expect(store.getState()).toEqual({
    serverState: {
      user: {
        email: "dtownsend@oxymoronical.com",
        fullname: "Dave Townsend",
        created: expect.toEqualDate("2017-10-23T23:34:21Z"),
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
        type: PageType.Index,
      },
    },
  });
});
