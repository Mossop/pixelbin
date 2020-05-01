import { isLoggedIn, focus, createDraft, uuid } from "../../js/utils/helpers";
import { expect, resetDOM, mockStore, mockServerData } from "../helpers";

beforeEach(resetDOM);

test("isLoggedIn", (): void => {
  let loggedIn = mockStore({
    serverState: mockServerData(),
  });

  expect(isLoggedIn(loggedIn)).toBeTruthy();

  let loggedOut = mockStore({
    serverState: { user: null },
  });

  expect(isLoggedIn(loggedOut)).toBeFalsy();
});

test("uuid", (): void => {
  expect(uuid()).not.toEqual(uuid());
});

test("createDraft", (): void => {
  expect(createDraft(5)).toEqual(5);
  expect(createDraft("foo")).toEqual("foo");

  expect(createDraft(["foo", "bar"])).toEqual(["foo", "bar"]);

  expect(createDraft(new Map([
    ["foo", "bar"],
    ["bar", "baz"],
  ]))).toEqual(new Map([
    ["foo", "bar"],
    ["bar", "baz"],
  ]));

  expect(createDraft(new Set([
    "foo",
    "bar",
    "bar",
    "baz",
  ]))).toEqual(new Set([
    "foo",
    "bar",
    "baz",
  ]));

  expect(createDraft({
    foo: undefined,
    bar: null,
    bas: 6,
    test: ["a", "b", "c"],
    map: new Map([["a", "b"]]),
  })).toEqual({
    foo: undefined,
    bar: null,
    bas: 6,
    test: ["a", "b", "c"],
    map: new Map([["a", "b"]]),
  });
});

test("focus", (): void => {
  let anyelement = document.createElement("p");
  anyelement.id = "any";
  document.body.appendChild(anyelement);
  anyelement["focus"] = jest.fn();
  anyelement["select"] = jest.fn();

  focus("any");

  expect(anyelement["focus"]).toHaveBeenCalled();
  expect(anyelement["select"]).not.toHaveBeenCalled();

  let textarea = document.createElement("textarea");
  textarea.id = "textarea";
  document.body.appendChild(textarea);

  textarea["focus"] = jest.fn();
  textarea["select"] = jest.fn();

  focus("textarea");

  expect(textarea["focus"]).toHaveBeenCalled();
  expect(textarea["select"]).toHaveBeenCalled();

  let input = document.createElement("input");
  input.id = "input";
  document.body.appendChild(input);

  input["focus"] = jest.fn();
  input["select"] = jest.fn();

  focus("input");

  expect(input["focus"]).toHaveBeenCalled();
  expect(input["select"]).toHaveBeenCalled();

  focus("foo");
});
