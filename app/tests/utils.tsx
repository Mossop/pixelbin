/* eslint-disable import/export */
import { ReactLocalization, LocalizationProvider } from "@fluent/react";
import { render as testRender, RenderOptions, Queries, RenderResult } from "@testing-library/react";
import React, { ReactNode, ReactElement } from "react";
import { Provider } from "react-redux";

import store from "../js/store";

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

export * from "@testing-library/react";

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
