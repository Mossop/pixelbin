import React from "react";

import { expect, render, resetDOM, expectChild, click, l10nBundle } from "../test-helpers";
import Button from "./Button";

beforeEach(resetDOM);

test("button", (): void => {
  let listener = jest.fn();

  let { container } = render(<Button onClick={listener}>Hello</Button>);
  let button = expectChild(container, "button[type='button']");

  expect(listener).not.toHaveBeenCalled();

  click(button);
  expect(listener).toHaveBeenCalledTimes(1);

  expect(button.textContent).toBe("Hello");
});

test("localized button", (): void => {
  l10nBundle.addTranslation("barfoo", "\n  .title = tooltip title");

  let { container } = render(<Button l10n="foobar" tooltipL10n="barfoo" onClick={jest.fn()}/>);
  let button = expectChild(container, "button[type='button']");
  expect(button.getAttribute("title")).toBe("tooltip title");
  expect(button.textContent).toBe("foobar");
});
