import { render, waitFor } from "@testing-library/react";
import { deferCall } from "pixelbin-test-helpers";
import React from "react";

import fetch from "../environment/fetch";
import { expectChild } from "../test-helpers";
import { LocalizationContext } from "./LocalizationContext";
import { Localized } from "./Localized";

jest.mock("../environment/fetch", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn(),
  };
});

jest.mock("../environment/window", (): unknown => {
  return {
    __esModule: true,
    default: {
      navigator: {
        languages: ["en-FB"],
      },
    },
  };
});

test("localization context", async (): Promise<void> => {
  let { call, resolve } = deferCall(fetch as (url: string) => Promise<Response>);

  let { container } = render(<LocalizationContext baseurl="http://foo.bar/" locales={["en-FB"]}>
    <Localized l10n="foo">
      <span id="span"/>
    </Localized>
  </LocalizationContext>);

  let [url] = await call;
  expect(url).toBe("http://foo.bar/en-FB.txt");

  await resolve({
    ok: true,
    text: (): Promise<string> => Promise.resolve("foo = bar"),
  } as unknown as Response);

  let span = expectChild(container, "#span");
  await waitFor((): void => {
    expect(span.textContent).toBe("bar");
  });
});
