import { fireEvent } from "@testing-library/react";
import React from "react";

import { expect, render, resetDOM, expectChild } from "../test-helpers";
import { makeProperty } from "../utils/StateProxy";
import Selectbox, { Option } from "./Selectbox";

beforeEach(resetDOM);

test("selectbox", (): void => {
  let obj = {
    value: "val1",
  };

  let { container } = render(<Selectbox property={makeProperty(obj, "value")}>
    <Option l10n="opt1" value="val1"/>
    <Option l10n="opt2" value="val2"/>
    <Option l10n="opt3" value="val3"/>
  </Selectbox>);

  let select = expectChild(container, "select");
  expectChild(select, "option[value='val1']");
  expectChild(select, "option[value='val2']");
  expectChild(select, "option[value='val3']");

  select["value"] = "val2";
  fireEvent.change(select);
  expect(obj.value).toBe("val2");
});
