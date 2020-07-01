import React from "react";

import { expect, render, resetDOM, expectChild, click } from "../test-helpers";
import { makeProperty } from "../utils/StateProxy";
import Form, { FormFieldProps } from "./Form";

beforeEach(resetDOM);

test("full form", (): void => {
  let data = {
    name: "name",
    option: "opt1",
    message: "mess",
  };

  let fields: FormFieldProps[] = [{
    type: "text",
    id: "txtbx",
    labelL10n: "textbox-label",
    property: makeProperty(data, "name"),
  }, {
    type: "select",
    id: "slct",
    labelL10n: "select-label",
    property: makeProperty(data, "option"),
    options: [{
      l10n: "option1",
      value: "opt1",
    }, {
      l10n: "option2",
      value: "opt2",
    }, {
      l10n: "option3",
      value: "opt3",
    }],
  }, {
    type: "textarea",
    id: "txtarea",
    labelL10n: "textarea-label",
    property: makeProperty(data, "message"),
  }];

  let submit = jest.fn();

  let { container } = render(
    <Form title="title-text" submit="submit-label" fields={fields} onSubmit={submit}/>,
  );

  let form = expectChild(container, "form.form");
  let title = expectChild(form, "p.formTitle");
  expect(title.textContent).toBe("title-text");
  let submitBtn = expectChild(form, ".formSubmit > button[type='submit']");
  expect(submitBtn.textContent).toBe("submit-label");

  click(submitBtn);
  expect(submit).toHaveBeenCalledTimes(1);

  let grid = expectChild(form, ".fieldGrid.row");

  let label = expectChild(grid, ".fieldLabel label[for='txtbx']");
  expect(label.textContent).toBe("textbox-label");
  let field = expectChild(grid, ".fieldBox > input#txtbx[type='text']");
  expect(label.parentElement?.nextElementSibling).toBe(field.parentElement);

  label = expectChild(grid, ".fieldLabel label[for='slct']");
  expect(label.textContent).toBe("select-label");
  field = expectChild(grid, ".fieldBox > select#slct");
  expect(label.parentElement?.nextElementSibling).toBe(field.parentElement);

  label = expectChild(grid, ".fieldLabel label[for='txtarea']");
  expect(label.textContent).toBe("textarea-label");
  field = expectChild(grid, ".fieldBox > textarea#txtarea");
  expect(label.parentElement?.nextElementSibling).toBe(field.parentElement);
});

test("basic form", (): void => {
  let submit = jest.fn();

  let { container } = render(<Form orientation="column" onSubmit={submit}/>);

  let form = expectChild(container, "form.form");
  expect(form.querySelector(".formTitle")).toBeNull();
  expect(form.querySelector(".formSubmit")).toBeNull();

  let grid = expectChild(form, ".fieldGrid.column");
  expect(grid.childElementCount).toBe(0);
});
