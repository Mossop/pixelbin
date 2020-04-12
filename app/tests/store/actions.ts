import store, { asyncDispatch } from "../../js/store";
import actions from "../../js/store/actions";
import { reset } from "../utils";

beforeEach(reset);

test("logging in should update state", async (): Promise<void> => {
  expect(store.getState().serverState).toEqual({
    user: null,
  });

  let newServerState = {
    user: {
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      hadCatalog: false,
      verified: true,
      catalogs: new Map(),
    },
  };

  let state = await asyncDispatch(actions.completeLogin(newServerState));

  expect(state.serverState).toEqual(newServerState);
});
