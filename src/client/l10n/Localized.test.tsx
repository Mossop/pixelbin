import { Localized as FluentLocalized } from "@fluent/react";

import { mockedFunction } from "../../test-helpers";
import { render } from "../test-helpers";
import { Localized } from "./Localized";

/* eslint-disable */
jest.mock("@fluent/react", () => {
  let actual = jest.requireActual("@fluent/react");
  return {
    ...actual,
    Localized: jest.fn((...args) => actual.Localized(...args)),
  };
});
/* eslint-enable */

const mockLocalized = mockedFunction(FluentLocalized);

test("localized element with id", (): void => {
  render(<Localized l10n="foo"/>);

  expect(mockLocalized.mock.calls.length).toBe(1);
  expect(mockLocalized.mock.calls[0][0]).toEqual({
    id: "foo",
  });
});

test("localized element with vars", (): void => {
  render(<Localized
    l10n={
      {
        id: "foobar",
        vars: {
          id: "test",
          val: 5,
        },
      }
    }
  />);

  expect(mockLocalized.mock.calls.length).toBe(1);
  expect(mockLocalized.mock.calls[0][0]).toEqual({
    id: "foobar",
    vars: {
      id: "test",
      val: 5,
    },
  });
});
