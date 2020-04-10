import { Encoded } from "../js/api/helpers";
import { PageType } from "../js/pages";
import { ServerState } from "../js/store/types";

describe("store initialization", (): void => {
  afterEach((): void => {
    while (document.body.firstChild) {
      document.body.firstChild.remove();
    }
  });

  test("no initial state", (): void => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { default: store } = require("../js/store");
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

  test("initial state", (): void => {
    let serverState: Encoded<ServerState> = {
      user: {
        email: "dtownsend@oxymoronical.com",
        fullname: "Dave Townsend",
        hadCatalog: false,
        verified: true,
        catalogs: [],
      },
    };

    let div = document.createElement("div");
    div.id = "initial-state";
    div.textContent = JSON.stringify(serverState);
    document.body.appendChild(div);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { default: store } = require("../js/store");
    expect(store.getState()).toEqual({
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
