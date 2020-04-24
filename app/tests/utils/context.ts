import { expect, resetDOM } from "../helpers";

beforeEach(resetDOM);

test("Path decoding missing items", async (): Promise<void> => {
  let element = document.createElement("pre");
  element.textContent = JSON.stringify({
    root: "/root/",
  });
  element.id = "paths";
  document.body.append(element);

  const { Url, appURL } = await import("../../js/context");
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

  const { Url, appURL } = await import("../../js/context");
  expect(appURL(Url.Root).toString()).toEqual("http://pixelbin/root/");
  expect(appURL(Url.API).toString()).toEqual("http://pixelbin/api/");
  expect(appURL(Url.Static).toString()).toEqual("http://pixelbin/root/static/");
  expect(appURL(Url.L10n).toString()).toEqual("http://pixelbin/l10n/");
});
