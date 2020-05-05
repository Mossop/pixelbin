import { expect, resetDOM, mockServerData } from "../test-helpers";
import { serverDataIntoResponse } from "../test-helpers/api";

beforeEach(resetDOM);

test("Path decoding missing items", async (): Promise<void> => {
  let element = document.createElement("pre");
  element.textContent = JSON.stringify({
    root: "/root/",
  });
  element.id = "paths";
  document.body.append(element);

  const { Url, appURL } = await import(".");
  expect(appURL(Url.Root).toString()).toEqual("http://pixelbin/root/");
  expect(appURL(Url.API).toString()).toEqual("http://pixelbin/root/api/");
  expect(appURL(Url.Static).toString()).toEqual("http://pixelbin/root/static/");
  expect(appURL(Url.L10n).toString()).toEqual("http://pixelbin/root/static/l10n/");
});

test("Path decoding missing some items", async (): Promise<void> => {
  let element = document.createElement("pre");
  element.textContent = JSON.stringify({
    root: "/root/",
    l10n: "/l10n/",
    api: "/api/",
  });
  element.id = "paths";
  document.body.append(element);

  const { Url, appURL } = await import(".");
  expect(appURL(Url.Root).toString()).toEqual("http://pixelbin/root/");
  expect(appURL(Url.API).toString()).toEqual("http://pixelbin/api/");
  expect(appURL(Url.Static).toString()).toEqual("http://pixelbin/root/static/");
  expect(appURL(Url.L10n).toString()).toEqual("http://pixelbin/l10n/");
});

test("App container", async (): Promise<void> => {
  let element = document.createElement("div");
  element.id = "app";
  document.body.append(element);

  const { appContainer } = await import(".");
  expect(appContainer()).toBe(element);
});

test("Initial server state", async (): Promise<void> => {
  let serverData = mockServerData();

  let element = document.createElement("pre");
  element.textContent = JSON.stringify(serverDataIntoResponse(serverData));
  element.id = "initial-state";
  document.body.append(element);

  const { initialServerState } = await import(".");
  expect(initialServerState()).toEqual(serverData);
});
