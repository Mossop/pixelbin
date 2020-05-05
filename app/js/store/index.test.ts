import { ServerDataDecoder, ServerData } from "../api";
import { Encoded } from "../api/helpers";
import { PageType } from "../pages/types";
import { decode } from "../utils/decoders";
import actions from "./actions";

describe("store initialization", (): void => {
  afterEach((): void => {
    while (document.body.firstChild) {
      document.body.firstChild.remove();
    }
  });

  test("no initial state", (): void => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { default: store } = require("../../js/store");
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
    let serverState: Encoded<ServerData> = {
      user: {
        email: "dtownsend@oxymoronical.com",
        fullname: "Dave Townsend",
        hadCatalog: false,
        verified: true,
        catalogs: [],
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { asyncDispatch } = require("../../js/store");
    let state = await asyncDispatch(
      actions.updateServerState(decode(ServerDataDecoder, serverState)),
    );

    expect(state).toEqual({
      serverState: {
        user: {
          email: "dtownsend@oxymoronical.com",
          fullname: "Dave Townsend",
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
