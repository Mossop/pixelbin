import { lastCallArgs } from "pixelbin-test-helpers";
import React from "react";

import {
  render,
  mockStore,
  mockStoreState,
  expectChild,
  click,
} from "../test-helpers";
import { InternalError, ErrorCode } from "../utils/exception";
import Overlay from "./Overlay";

jest.mock("./Button");

test("overlay", (): void => {
  let store = mockStore(mockStoreState({}));

  let { container } = render(<Overlay/>, store);

  let closeButton = expectChild(container, "div#overlay-close");
  click(closeButton);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "closeOverlay",
    payload: [],
  });

  let testSidebar = <div id="test-sidebar"/>;
  let error = new InternalError(ErrorCode.InvalidState);
  container = render(
    <Overlay title="test-title" error={error} sidebar={testSidebar}/>,
    store,
  ).container;
  let title = expectChild(container, ".title");
  expect(title.textContent).toBe("test-title");
  let errorMessage = expectChild(container, "#overlay-error");
  expect(errorMessage.textContent).toBe("internal-error-invalid-state");
  let sidebar = expectChild(container, "#overlay-sidebar");
  expectChild(sidebar, "#test-sidebar");
});
