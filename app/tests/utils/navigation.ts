import { APIItemReference, Catalog } from "../../js/api/highlevel";
import { ServerData } from "../../js/api/types";
import { PageType } from "../../js/pages";
import { HistoryState } from "../../js/utils/history";
import { intoUIState, fromUIState } from "../../js/utils/navigation";
import { reset, buildServerData, deref } from "../utils";

beforeEach(reset);

function state(path: string, params?: {}): HistoryState {
  return {
    path,
    params: params ? new Map(Object.entries(params)) : undefined,
  };
}

const LoggedOut: ServerData = {
  user: null,
};

const LoggedIn = buildServerData([{
  id: "testcatalog",
  name: "Test1",
}]);

test("index page", (): void => {
  expect(intoUIState(state("/"), LoggedOut)).toEqual({
    page: {
      type: PageType.Index,
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.Index,
    },
  })).toEqual(state("/"));
});

test("not found", (): void => {
  expect(intoUIState(state("/foo/bar"), LoggedOut)).toEqual({
    page: {
      type: PageType.NotFound,
      history: state("/foo/bar"),
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.NotFound,
      history: state("/foo/bar"),
    },
  })).toEqual(state("/foo/bar"));
});

test("catalog page", (): void => {
  expect(intoUIState(state("/catalog/testcatalog"), LoggedOut)).toEqual({
    page: {
      type: PageType.NotFound,
      history: state("/catalog/testcatalog"),
    },
  });

  expect(deref(intoUIState(state("/catalog/testcatalog"), LoggedIn))).toEqual({
    page: {
      type: PageType.Catalog,
      catalog: "testcatalog",
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.Catalog,
      catalog: new APIItemReference("testcatalog", Catalog),
    },
  })).toEqual(state("/catalog/testcatalog"));
});
