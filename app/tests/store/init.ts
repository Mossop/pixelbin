import { ServerDataDecoder, ServerData } from "../../js/api";
import { Encoded } from "../../js/api/helpers";
import { PageType } from "../../js/pages";
import actions from "../../js/store/actions";
import { decode } from "../../js/utils/decoders";

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
