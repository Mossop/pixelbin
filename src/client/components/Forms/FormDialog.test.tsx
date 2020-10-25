import React from "react";

import { click, expectChild, render } from "../../test-helpers";
import FormDialog from "./FormDialog";

test("basic form dialog", async (): Promise<void> => {
  let submit = jest.fn();
  let close = jest.fn();

  let { dialogContainer } = render(
    <FormDialog titleId="foo" onSubmit={submit} onClose={close}/>,
  );
  let form = expectChild(dialogContainer, "form");
  expect(form.querySelector("#form-dialog-error")).toBeNull();

  let title = expectChild(form, "#form-dialog-title");
  expect(title.textContent).toBe("foo");

  let cancelButton = expectChild<HTMLButtonElement>(form, "#form-dialog-cancel");
  expect(cancelButton.textContent).toBe("form-cancel");
  expect(cancelButton.disabled).toBeFalsy();
  let submitButton = expectChild<HTMLButtonElement>(form, "#form-dialog-submit");
  expect(submitButton.textContent).toBe("form-submit");
  expect(submitButton.disabled).toBeFalsy();

  expect(submit).not.toHaveBeenCalled();
  click(submitButton);
  expect(submit).toHaveBeenCalledTimes(1);

  expect(close).not.toHaveBeenCalled();
  click(cancelButton);
  expect(close).toHaveBeenCalledTimes(1);
});

test("custom form dialog", async (): Promise<void> => {
  let submit = jest.fn();
  let close = jest.fn();

  let { dialogContainer, rerender } = render(
    <FormDialog
      id="mydialog"
      titleId="bar"
      canSubmit={true}
      submitId="mysubmit"
      onSubmit={submit}
      cancelId="mycancel"
      onClose={close}
    >
      <div id="mycontent"/>
    </FormDialog>,
  );
  let form = expectChild(dialogContainer, "#mydialog");
  expect(form.localName).toBe("form");
  expect(form.querySelector("#mydialog-error")).toBeNull();
  expectChild(form, "#mycontent");

  let title = expectChild(form, "#mydialog-title");
  expect(title.textContent).toBe("bar");

  let cancelButton = expectChild<HTMLButtonElement>(form, "#mydialog-cancel");
  expect(cancelButton.textContent).toBe("mycancel");
  expect(cancelButton.disabled).toBeFalsy();
  let submitButton = expectChild<HTMLButtonElement>(form, "#mydialog-submit");
  expect(submitButton.textContent).toBe("mysubmit");
  expect(submitButton.disabled).toBeFalsy();

  rerender(
    <FormDialog
      id="mydialog"
      error="my bad"
      disabled={true}
      titleId="bar"
      submitId="mysubmit"
      onSubmit={submit}
      cancelId="mycancel"
      onClose={close}
    />,
  );

  let error = expectChild(dialogContainer, "#mydialog-error");
  expect(error.textContent).toBe("my bad");
  expect(cancelButton.disabled).toBeTruthy();
  expect(submitButton.disabled).toBeTruthy();

  rerender(
    <FormDialog
      id="mydialog"
      titleId="bar"
      canSubmit={false}
      submitId="mysubmit"
      onSubmit={submit}
      cancelId="mycancel"
      onClose={close}
    />,
  );

  expect(cancelButton.disabled).toBeFalsy();
  expect(submitButton.disabled).toBeTruthy();

  click(submitButton);
  expect(submit).not.toHaveBeenCalled();
});
