import type { Draft } from "immer";

import { PageType } from "../pages/types";
import type { UIState } from "../store/types";
import {
  expect,
  render,
  resetDOM,
  expectChild,
  click,
  mockStore,
  mockStoreState,
} from "../test-helpers";
import Link from "./Link";

beforeEach(resetDOM);

test("link", (): void => {
  let store = mockStore(mockStoreState());

  let target: Draft<UIState> = {
    page: {
      type: PageType.User,
    },
  };

  let { container } = render(<Link to={target}>foo</Link>, store);
  let link = expectChild(container, "a");

  click(link);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch.mock.calls[0][0]).toEqual({
    type: "pushUIState",
    payload: [target],
  });
});
