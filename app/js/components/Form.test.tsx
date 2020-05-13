import React from "react";

import { expect, render, resetDOM, expectChild, click } from "../test-helpers";
import { makeProperty } from "../utils/StateProxy";
import Form, { FormFieldProps } from "./Form";

jest.mock("../l10n/Localized");

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
    labelL10n: "textbox",
    property: makeProperty(data, "name"),
  }, {
    type: "select",
    id: "slct",
    labelL10n: "select",
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
    labelL10n: "textarea",
    property: makeProperty(data, "message"),
  }];

  let submit = jest.fn();

  let { container } = render(
    <Form title="title" submit="submit" fields={fields} onSubmit={submit}/>,
  );

  let form = expectChild(container, "form.form");
  expectChild(form, ".mock-localized[data-l10nid='title'] > p.formTitle");
  let submitBtn = expectChild(
    form,
    ".formSubmit > .mock-localized[data-l10nid='submit'] > button[type='submit']",
  );

  click(submitBtn);
  expect(submit).toHaveBeenCalledTimes(1);

  let grid = expectChild(form, ".fieldGrid.row");

  let label = expectChild(
    grid,
    ".fieldLabel > .mock-localized[data-l10nid='textbox'] > label[for='txtbx']",
  );
  let field = expectChild(grid, ".fieldBox > input#txtbx[type='text']");
  expect(label.parentElement?.parentElement?.nextElementSibling).toBe(field.parentElement);

  label = expectChild(
    grid,
    ".fieldLabel > .mock-localized[data-l10nid='select'] > label[for='slct']",
  );
  field = expectChild(grid, ".fieldBox > select#slct");
  expect(label.parentElement?.parentElement?.nextElementSibling).toBe(field.parentElement);

  label = expectChild(
    grid,
    ".fieldLabel > .mock-localized[data-l10nid='textarea'] > label[for='txtarea']",
  );
  field = expectChild(grid, ".fieldBox > textarea#txtarea");
  expect(label.parentElement?.parentElement?.nextElementSibling).toBe(field.parentElement);
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
