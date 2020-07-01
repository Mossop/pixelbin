import React from "react";

import { asyncDispatch } from "../store";
import actions from "../store/actions";
import { expect, expectElement, render, resetDOM } from "../test-helpers";
import { If, Then, Else } from "./Conditions";

beforeEach(async (): Promise<void> => {
  resetDOM();

  await asyncDispatch(actions.updateServerState({
    user: null,
  }));
});

describe("Simple boolean condition", (): void => {
  it("true", (): void => {
    let { container } = render(<If condition={true}>
      <Then>
        <div id="then"/>
      </Then>
      <Else>
        <div id="else"/>
      </Else>
    </If>);

    let node = expectElement(container.firstElementChild);
    expect(node.localName).toBe("div");
    expect(node.id).toBe("then");
  });

  it("false", (): void => {
    let { container } = render(<If condition={false}>
      <Then>
        <div id="then"/>
      </Then>
      <Else>
        <div id="else"/>
      </Else>
    </If>);

    let node = expectElement(container.firstElementChild);
    expect(node.localName).toBe("div");
    expect(node.id).toBe("else");
  });
});

describe("Boolean function condition", (): void => {
  it("true", (): void => {
    let condition = (): boolean => true;

    let { container } = render(<If condition={condition}>
      <Then>
        <div id="then"/>
      </Then>
      <Else>
        <div id="else"/>
      </Else>
    </If>);

    let node = expectElement(container.firstElementChild);
    expect(node.localName).toBe("div");
    expect(node.id).toBe("then");
  });

  it("false", (): void => {
    let condition = (): boolean => false;

    let { container } = render(<If condition={condition}>
      <Then>
        <div id="then"/>
      </Then>
      <Else>
        <div id="else"/>
      </Else>
    </If>);

    let node = expectElement(container.firstElementChild);
    expect(node.localName).toBe("div");
    expect(node.id).toBe("else");
  });
});
