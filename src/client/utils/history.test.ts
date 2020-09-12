import { mockedFunction } from "../../test-helpers";
import window from "../environment/window";
import { jsdom, expect } from "../test-helpers";
import { ErrorCode } from "./exception";
import {
  getState,
  pushState,
  replaceState,
  addListener,
  removeListener,
  HistoryState,
  buildState,
} from "./history";

let globalState: unknown = undefined;

/* eslint-disable */
jest.mock("../environment/window", () => {
  let actual = jest.requireActual("../environment/window");
  return {
    __esModule: true,
    default: Object.create(actual.default, {
      addEventListener: {
        writable: false,
        configurable: false,
        value: jest.fn(),
      },
      history: {
        writable: false,
        configurable: false,
        value: {
          pushState: jest.fn(),
          replaceState: jest.fn(),
          get state() {
            return globalState;
          },
        }
      },
    }),
  };
});
/* eslint-enable */

const mockedAddEventListener = mockedFunction(window.addEventListener);
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockedPushState = mockedFunction(window.history.pushState);
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockedReplaceState = mockedFunction(window.history.replaceState);

test("getState", (): void => {
  jsdom.reconfigure({
    url: "https://foo.com/baz",
  });

  expect(getState()).toEqual({
    path: "/baz",
    params: new Map(),
    hash: undefined,
    state: undefined,
  });

  globalState = { "bar": "pub" };
  jsdom.reconfigure({
    url: "https://foo.com/biz#test",
  });

  expect(getState()).toEqual({
    path: "/biz",
    params: new Map(),
    hash: "test",
    state: { "bar": "pub" },
  });

  globalState = "27";
  jsdom.reconfigure({
    url: "https://foo.com/biz?a=true&b=bar#test",
  });

  expect(getState()).toEqual({
    path: "/biz",
    params: new Map([
      ["a", "true"],
      ["b", "bar"],
    ]),
    hash: "test",
    state: "27",
  });

  expect((): void => {
    buildState("foo");
  }).toThrowAppError(ErrorCode.InvalidState);
});

test("update states.", (): void => {
  pushState({
    path: "/foobar",
  });

  expect(mockedPushState).toHaveBeenCalledWith(undefined, "", "https://foo.com/foobar");
  mockedPushState.mockClear();

  pushState({
    path: "/biz/baz.html",
    hash: "foobar",
    state: {
      a: "b",
    },
  });

  expect(mockedPushState).toHaveBeenCalledWith({
    a: "b",
  }, "", "https://foo.com/biz/baz.html#foobar");
  mockedPushState.mockClear();

  pushState({
    path: "/biz/baz.html",
    params: new Map([
      ["a", "b"],
      ["check", "t=b"],
    ]),
  });

  expect(mockedPushState).toHaveBeenCalledWith(
    undefined,
    "",
    "https://foo.com/biz/baz.html?a=b&check=t%3Db",
  );
  mockedPushState.mockClear();

  expect(mockedReplaceState).not.toHaveBeenCalled();

  replaceState({
    path: "/foobar",
  });

  expect(mockedReplaceState).toHaveBeenCalledWith(undefined, "", "https://foo.com/foobar");
  mockedReplaceState.mockClear();

  expect(mockedPushState).not.toHaveBeenCalled();
});

test("listeners", (): void => {
  expect(mockedAddEventListener).not.toHaveBeenCalled();

  let mockListener = jest.fn<void, [HistoryState]>();
  addListener(mockListener);

  expect(mockedAddEventListener).toHaveBeenCalled();
  expect(mockedAddEventListener.mock.calls[0][0]).toBe("popstate");
  let eventListener = mockedAddEventListener.mock.calls[0][1] as () => void;

  expect(mockListener).not.toHaveBeenCalled();

  globalState = { "bar": "pub" };
  jsdom.reconfigure({
    url: "https://foo.com/biz#test",
  });

  eventListener();

  expect(mockListener).toHaveBeenCalledWith({
    path: "/biz",
    hash: "test",
    params: new Map(),
    state: {
      bar: "pub",
    },
  });
  mockListener.mockClear();

  addListener(mockListener);

  eventListener();

  expect(mockListener).toHaveBeenCalledTimes(1);
  mockListener.mockClear();

  removeListener(mockListener);

  eventListener();

  expect(mockListener).not.toHaveBeenCalled();
});
