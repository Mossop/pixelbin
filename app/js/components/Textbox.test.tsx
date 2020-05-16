import React from "react";

import { resetDOM, render, typeString, expectChild } from "../test-helpers";
import { makeProperty } from "../utils/StateProxy";
import Textbox from "./Textbox";

beforeEach(resetDOM);

test("Textbox", (): void => {
  let data = {
    value: "",
  };

  let { container } = render(<Textbox type="text" property={makeProperty(data, "value")}/>);
  let input = expectChild(container, "input[type='text']");

  typeString(input, "Hello");

  expect(data.value).toBe("Hello");
});
