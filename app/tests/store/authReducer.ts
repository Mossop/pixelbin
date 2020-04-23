import { ServerData } from "../../js/api/types";
import { OverlayType } from "../../js/overlays";
import { PageType } from "../../js/pages";
import actions from "../../js/store/actions";
import reducer from "../../js/store/reducer";
import { mockStore, mockServerData, expect } from "../helpers";

test("Logging in with a catalog", (): void => {
  let state = mockStore({
    serverState: { user: null },
  });

  let newServerData = mockServerData([{
    id: "testcatalog",
    name: "Test catalog",
  }]);

  let action = actions.completeLogin(newServerData);
  let newState = reducer(state, action);

  let expectedUI = {
    page: {
      type: PageType.Catalog,
      catalog: expect.toBeRef("testcatalog"),
    },
  };

  expect(newState.serverState).toEqual(newServerData);
  expect(newState.ui).toEqual(expectedUI);
});

test("Logging in with multiple catalogs", (): void => {
  let state = mockStore({
    serverState: { user: null },
  });

  let newServerData = mockServerData([{
    id: "testcatalog1",
    name: "Test catalog",
  }, {
    id: "testcatalog2",
    name: "Another test catalog",
  }]);

  let action = actions.completeLogin(newServerData);
  let newState = reducer(state, action);

  let expectedUI = {
    page: {
      type: PageType.Catalog,
      catalog: expect.toBeRef("testcatalog2"),
    },
  };

  expect(newState.serverState).toEqual(newServerData);
  expect(newState.ui).toEqual(expectedUI);
});

test("Logging in with no catalogs", (): void => {
  let state = mockStore({
    serverState: { user: null },
  });

  let newServerData: ServerData = {
    user: {
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      hadCatalog: true,
      verified: true,
      catalogs: new Map(),
    },
  };

  let action = actions.completeLogin(newServerData);
  let newState = reducer(state, action);

  let expectedUI = {
    page: {
      type: PageType.User,
    },
  };

  expect(newState.serverState).toEqual(newServerData);
  expect(newState.ui).toEqual(expectedUI);
});

test("Logging in with no catalogs shows catalog create", (): void => {
  let state = mockStore({
    serverState: { user: null },
  });

  let newServerData: ServerData = {
    user: {
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      hadCatalog: false,
      verified: true,
      catalogs: new Map(),
    },
  };

  let action = actions.completeLogin(newServerData);
  let newState = reducer(state, action);

  let expectedUI = {
    page: {
      type: PageType.User,
    },
    overlay: {
      type: OverlayType.CreateCatalog,
    },
  };

  expect(newState.serverState).toEqual(newServerData);
  expect(newState.ui).toEqual(expectedUI);
});

test("Show login overlay.", (): void => {
  let state = mockStore({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Index,
      },
    },
  });

  let action = actions.showLoginOverlay();
  let newState = reducer(state, action);

  let expectedUI = {
    page: {
      type: PageType.Index,
    },
    overlay: {
      type: OverlayType.Login,
    },
  };

  expect(newState.ui).toEqual(expectedUI);
});
