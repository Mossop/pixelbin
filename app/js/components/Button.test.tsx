import React from "react";

import { expect, render, resetDOM, expectChild, click } from "../test-helpers";
import Button from "./Button";

beforeEach(resetDOM);

jest.mock("../l10n/Localized");

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
  let { container } = render(<Button l10n="foobar" tooltipL10n="barfoo" onClick={jest.fn()}/>);
  let tooltip = expectChild(container, "div.localized[id='barfoo']");
  let button = expectChild(tooltip, "button[type='button']");
  expectChild(button, "div.localized[id='foobar']");
});
