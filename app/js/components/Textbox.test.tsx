import React from "react";

import { resetDOM, render, sendString, expectChild } from "../test-helpers";
import { makeProperty } from "../utils/StateProxy";
import Textbox from "./Textbox";

beforeEach(resetDOM);

test("Textbox", (): void => {
  let data = {
    value: "",
  };

  let { container } = render(<Textbox type="text" property={makeProperty(data, "value")}/>);
  let input = expectChild(container, "input[type='text']");

  container.addEventListener("change", (): void => {
    console.error("here");
  });

  sendString(input, "Hello");

  expect(data.value).toBe("Hello");
});
