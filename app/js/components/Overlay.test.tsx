import React from "react";

import {
  render,
  mockStore,
  mockStoreState,
  expectChild,
  click,
  lastCallArgs,
} from "../test-helpers";
import { InternalError, ErrorCode } from "../utils/exception";
import Overlay from "./Overlay";

jest.mock("./Button");
jest.mock("../l10n/Localized");

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
  expectChild(container, ".mock-localized[data-l10nid='test-title']");
  expectChild(container, ".mock-localized[data-l10nid='internal-error-invalid-state']");
  let sidebar = expectChild(container, "#overlay-sidebar");
  expectChild(sidebar, "#test-sidebar");
});
