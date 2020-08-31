import { FluentBundle, FluentResource } from "@fluent/bundle";
import { Message } from "@fluent/bundle/esm/ast";
import { ReactLocalization, LocalizationProvider } from "@fluent/react";
import {
  RenderResult,
  render as testRender,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { JSDOM } from "jsdom";
import React from "react";
import { Provider } from "react-redux";

import realStore from "../store";
import { StoreType } from "../store/types";
import { ReactChildren, ReactResult } from "../utils/types";
import { MockStore } from "./store";

// @ts-ignore: TypeScript doesn't know about this global.
const dom: JSDOM = jsdom;

export { dom as jsdom };

export function expectChild<T extends Element = Element>(
  container: Element | null,
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

type Wrapper = (props: ReactChildren) => ReactResult;
function componentWrapper(store: MockStore | undefined): Wrapper {
  let fakeStore: StoreType = store ? store as unknown as StoreType : realStore;
  return function WrappedComponent({ children }: ReactChildren): ReactResult {
    let l10n = new ReactLocalization([l10nBundle]);

    return <Provider store={fakeStore}>
      <LocalizationProvider l10n={l10n}>
        {children}
      </LocalizationProvider>
    </Provider>;
  };
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

export async function resetDOM(): Promise<void> {
  await cleanup();

  while (document.head.firstChild) {
    document.head.firstChild.remove();
  }

  while (document.body.firstChild) {
    document.body.firstChild.remove();
  }
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
