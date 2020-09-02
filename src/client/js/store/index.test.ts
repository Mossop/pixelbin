import { Api, ResponseFor } from "../../../model";
import { decode } from "../../../utils";
import { StateDecoder } from "../api/decoders";
import { serverStateIntoState } from "../api/types";
import { PageType } from "../pages/types";
import { expect } from "../test-helpers";
import actions from "./actions";

describe("store initialization", (): void => {
  afterEach((): void => {
    while (document.body.firstChild) {
      document.body.firstChild.remove();
    }
  });

  test("no initial state", (): void => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { default: store } = require("../store");
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
      stateId: 0,
    });
  });

  test("update server state", async (): Promise<void> => {
    let serverState: ResponseFor<Api.State> = {
      user: {
        email: "dtownsend@oxymoronical.com",
        fullname: "Dave Townsend",
        created: "2017-10-23T23:34:21Z",
        hadCatalog: false,
        verified: true,
        catalogs: [],
        albums: [],
        people: [],
        tags: [],
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { asyncDispatch } = require("../store");
    let state = await asyncDispatch(
      actions.updateServerState(serverStateIntoState(decode(StateDecoder, serverState))),
    );

    expect(state).toEqual({
      serverState: {
        user: {
          email: "dtownsend@oxymoronical.com",
          fullname: "Dave Townsend",
          created: expect.toEqualDate("2017-10-23T23:34:21Z"),
          hadCatalog: false,
          verified: true,
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
      stateId: 0,
    });
  });
});
