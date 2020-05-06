import { ReactLocalization, LocalizationProvider } from "@fluent/react";
import {
  RenderOptions,
  RenderResult,
  Queries,
  render as testRender,
  fireEvent,
} from "@testing-library/react";
import { JSDOM } from "jsdom";
import React, { ReactElement, ReactNode } from "react";
import { Provider } from "react-redux";

import store from "../store";

// @ts-ignore
const dom: JSDOM = jsdom;

export { dom as jsdom };

export function expectChild(container: Element, selector: string): Element {
  let elems = container.querySelectorAll(selector);
  expect(elems).toHaveLength(1);
  return elems[0];
}

export function expectElement(node: Node | null): Element {
  expect(node).not.toBeNull();
  expect(node?.nodeType).toBe(Node.ELEMENT_NODE);

  return node as Element;
}

function WrapComponent({ children }: { children?: ReactNode }): ReactElement | null {
  let l10n = new ReactLocalization([]);

  return <Provider store={store}>
    <LocalizationProvider l10n={l10n}>
      {children}
    </LocalizationProvider>
  </Provider>;
}

export function render(ui: ReactElement, options?: Omit<RenderOptions, "queries">): RenderResult;
export function render<Q extends Queries>(
  ui: ReactElement,
  options: RenderOptions<Q>,
): RenderResult<Q>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function render(ui: any, options?: any): any {
  let results = testRender(ui, { wrapper: WrapComponent, ...options });
  return {
    ...results,
  };
}

export function resetDOM(): void {
  while (document.head.firstChild) {
    document.head.firstChild.remove();
  }

  while (document.body.firstChild) {
    document.body.firstChild.remove();
  }
}

export function click(element: Element): void {
  fireEvent.click(element);
}
