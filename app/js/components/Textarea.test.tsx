import React from "react";

import { resetDOM, render, sendString, expectChild } from "../test-helpers";
import { makeProperty } from "../utils/StateProxy";
import Textarea from "./Textarea";

beforeEach(resetDOM);

test("Textarea", (): void => {
  let data = {
    value: "",
  };

  let { container } = render(<Textarea property={makeProperty(data, "value")}/>);
  let textarea = expectChild(container, "textarea");

  sendString(textarea, "Hello");

  expect(data.value).toBe("Hello");
});
