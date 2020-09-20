import { FluentBundle, FluentResource } from "@fluent/bundle";
import { Message } from "@fluent/bundle/esm/ast";
import { ReactLocalization, LocalizationProvider } from "@fluent/react";
import { ThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import {
  RenderResult,
  render as testRender,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { match as matchMediaQuery, MediaValues } from "css-mediaquery";
import { JSDOM } from "jsdom";
import React, { Suspense } from "react";
import { Provider } from "react-redux";

import { StoreType } from "../store/types";
import { ReactChildren, ReactResult } from "../utils/types";
import { MockStore } from "./store";

// @ts-ignore: TypeScript doesn't know about this global.
const dom: JSDOM = jsdom;

export { dom as jsdom };

export function expectChild<T extends Element = Element>(
  container: ParentNode | null,
  selector: string,
): T {
  expect(container).not.toBeNull();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let elems = container!.querySelectorAll(selector);
  expect(elems).toHaveLength(1);
  return elems[0] as T;
}

export function expectElement(node: Node | null): Element {
  expect(node).not.toBeNull();
  expect(node?.nodeType).toBe(Node.ELEMENT_NODE);

  return node as Element;
}

/**
 * A FluentBundle that dynamically creates translations when needed.
 */
class MockBundle extends FluentBundle {
  public constructor() {
    super(["en-US"]);
  }

  public hasMessage(id: string): boolean {
    if (!super.hasMessage(id)) {
      let resource = new FluentResource(`${id} = ${id}`);
      this.addResource(resource);
    }

    return true;
  }

  public getMessage(id: string): Message | undefined {
    if (!this.hasMessage(id)) {
      return undefined;
    }

    return super.getMessage(id);
  }

  public addTranslation(id: string, translation: string): void {
    this.addResource(new FluentResource(`${id} = ${translation}`));
  }
}

export const l10nBundle = new MockBundle();

const theme = createMuiTheme({
  transitions: {
    create: () => "none",
  },
});

type Wrapper = (props: ReactChildren) => ReactResult;
function componentWrapper(store: MockStore | undefined): Wrapper {
  if (store) {
    return function WrappedComponent({ children }: ReactChildren): ReactResult {
      let l10n = new ReactLocalization([l10nBundle]);

      return <Provider store={store as unknown as StoreType}>
        <LocalizationProvider l10n={l10n}>
          <ThemeProvider theme={theme}>
            <Suspense fallback={<div className="loading"/>}>
              {children}
            </Suspense>
          </ThemeProvider>
        </LocalizationProvider>
      </Provider>;
    };
  } else {
    return function WrappedComponent({ children }: ReactChildren): ReactResult {
      let l10n = new ReactLocalization([l10nBundle]);

      return <LocalizationProvider l10n={l10n}>
        <ThemeProvider theme={theme}>
          <Suspense fallback={<div className="loading"/>}>
            {children}
          </Suspense>
        </ThemeProvider>
      </LocalizationProvider>;
    };
  }
}

export interface DialogRenderResult {
  dialogContainer: Element | null;
}

export function render(
  ui: React.ReactElement,
  store?: MockStore,
): RenderResult & DialogRenderResult {
  let results = testRender(ui, { wrapper: componentWrapper(store) });
  return {
    ...results,
    dialogContainer: results.container.ownerDocument.querySelector(".MuiDialog-root"),
  };
}

type MediaListener = (this: MediaQueryList, ev: MediaQueryListEvent) => unknown;

class MediaEvent extends window.Event implements MediaQueryListEvent {
  public constructor(public readonly matches: boolean, public readonly media: string) {
    super("change");
  }
}

class MediaQuery implements MediaQueryList {
  public matches: boolean;
  private listeners: Set<MediaListener>;
  private changeListener: MediaListener | null;

  public constructor(public readonly media: string) {
    this.matches = matchMediaQuery(media, Media);
    this.listeners = new Set();
    this.changeListener = null;
  }

  public addListener(listener: MediaListener): void {
    this.listeners.add(listener);
  }

  public removeListener(listener: MediaListener): void {
    this.listeners.delete(listener);
  }

  public get onchange(): MediaListener | null {
    return this.changeListener;
  }

  public set onchange(listener: MediaListener | null) {
    this.changeListener = listener;
  }

  public addEventListener(): void {
    return;
  }

  public removeEventListener(): void {
    return;
  }

  public dispatchEvent(): boolean {
    return false;
  }

  public update(): void {
    let newMatches = matchMediaQuery(this.media, Media);
    if (newMatches != this.matches) {
      this.matches = newMatches;
      let listeners = [...this.listeners];
      if (this.changeListener) {
        listeners.push(this.changeListener);
      }

      let ev = new MediaEvent(this.matches, this.media);

      for (let listener of listeners) {
        try {
          listener.call(this, ev);
        } catch (e) {
          // no-op
        }
      }
    }
  }
}

let MediaQueries: MediaQuery[] = [];
function updateQueries(): void {
  act(() => {
    for (let query of MediaQueries) {
      query.update();
    }
  });
}

const MediaValues = {
  width: 1024,
};

export const Media = {
  get width(): number {
    return MediaValues.width;
  },

  set width(val: number) {
    MediaValues.width = val;
    updateQueries();
  },
};

export async function resetDOM(): Promise<void> {
  cleanup();

  while (document.head.firstChild) {
    document.head.firstChild.remove();
  }

  while (document.body.firstChild) {
    document.body.firstChild.remove();
  }

  MediaQueries = [];
  window.matchMedia = (query: string) => {
    let mediaQuery = new MediaQuery(query);
    MediaQueries.push(mediaQuery);
    return mediaQuery;
  };
}

export function click(element: Element): void {
  act(() => {
    fireEvent.click(element);
  });
}

export function sendKey(element: Element, key: string): void {
  act(() => {
    fireEvent.keyDown(element, {
      key,
    });

    fireEvent.keyPress(element, {
      key,
    });

    fireEvent.keyUp(element, {
      key,
    });
  });
}

export function typeString(element: Element, str: string): void {
  act(() => {
    if (element instanceof HTMLInputElement) {
      let proto = Object.getPrototypeOf(element);
      let descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      descriptor?.set?.call(element, str);
      fireEvent.input(element, {
        data: str,
      });
    } else if (element instanceof HTMLTextAreaElement) {
      element.textContent = str;
      fireEvent.input(element, {
        data: str,
      });
    }
  });
}

export function submit(element: Element): void {
  act(() => {
    expect(element.localName).toBe("form");
    (element as HTMLFormElement).submit();
  });
}
