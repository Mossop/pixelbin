import { PageType } from "../js/pages";
import { ServerState } from "../js/store/types";
import { HistoryState } from "../js/utils/history";
import { intoUIState, fromUIState } from "../js/utils/navigation";
import { reset } from "./utils";

beforeEach(reset);

function state(path: string, params?: {}): HistoryState {
  return {
    path,
    params: params ? new Map(Object.entries(params)) : undefined,
  };
}

const LoggedOut: ServerState = {
  user: null,
};

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
  })).toEqual({
    path: "/",
  });
});
