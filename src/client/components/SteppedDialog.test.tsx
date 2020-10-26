import React from "react";

import { click, expectChild, render } from "../test-helpers";
import SteppedDialog, { Step } from "./SteppedDialog";

test("basic stepped dialog", async (): Promise<void> => {
  let submit = jest.fn();
  let close = jest.fn();
  let back = jest.fn();
  let next = jest.fn();

  let { dialogContainer, rerender } = render(
    <SteppedDialog
      titleId="foo"
      currentStep={0}
      onBackClick={back}
      onNextClick={next}
      onSubmit={submit}
      onClose={close}
    >
      <Step titleId="step1-title">
        <div id="step1"/>
      </Step>
      <Step titleId="step2-title">
        <div id="step2"/>
      </Step>
      <Step titleId="step3-title">
        <div id="step3"/>
      </Step>
    </SteppedDialog>,
  );
  let form = expectChild(dialogContainer, "form");
  expect(form.querySelector("#stepped-dialog-error")).toBeNull();

  let title = expectChild(form, "#stepped-dialog-title");
  expect(title.textContent).toBe("foo");

  let stepLabels = form.querySelectorAll(".MuiStepLabel-label");
  expect(stepLabels).toHaveLength(3);
  expect(stepLabels[0].textContent).toBe("step1-title");
  expect(stepLabels[1].textContent).toBe("step2-title");
  expect(stepLabels[2].textContent).toBe("step3-title");

  let cancelButton = expectChild<HTMLButtonElement>(form, "#stepped-dialog-cancel");
  expect(cancelButton.textContent).toBe("form-cancel");
  expect(cancelButton.disabled).toBeFalsy();
  let backButton = expectChild<HTMLButtonElement>(form, "#stepped-dialog-back");
  expect(backButton.textContent).toBe("form-back");
  expect(backButton.disabled).toBeTruthy();
  let nextButton = expectChild<HTMLButtonElement>(form, "#stepped-dialog-next");
  expect(nextButton.textContent).toBe("form-next");
  expect(nextButton.disabled).toBeFalsy();
  expect(form.querySelector("#stepped-dialog-submit")).toBeNull();

  let step1Content = expectChild(form, "#step1");
  let styles = form.ownerDocument.defaultView?.getComputedStyle(step1Content.parentElement!);
  expect(styles?.visibility).toBe("visible");

  let step2Content = expectChild(form, "#step2");
  styles = form.ownerDocument.defaultView?.getComputedStyle(step2Content.parentElement!);
  expect(styles?.visibility).toBe("hidden");

  let step3Content = expectChild(form, "#step3");
  styles = form.ownerDocument.defaultView?.getComputedStyle(step3Content.parentElement!);
  expect(styles?.visibility).toBe("hidden");

  expect(next).not.toHaveBeenCalled();
  click(nextButton);
  expect(next).toHaveBeenCalledTimes(1);
  next.mockClear();

  rerender(
    <SteppedDialog
      titleId="foo"
      currentStep={1}
      onBackClick={back}
      onNextClick={next}
      onSubmit={submit}
      onClose={close}
    >
      <Step titleId="step1-title">
        <div id="step1"/>
      </Step>
      <Step titleId="step2-title">
        <div id="step2"/>
      </Step>
      <Step titleId="step3-title">
        <div id="step3"/>
      </Step>
    </SteppedDialog>,
  );

  styles = form.ownerDocument.defaultView?.getComputedStyle(step1Content.parentElement!);
  expect(styles?.visibility).toBe("hidden");
  styles = form.ownerDocument.defaultView?.getComputedStyle(step2Content.parentElement!);
  expect(styles?.visibility).toBe("visible");
  styles = form.ownerDocument.defaultView?.getComputedStyle(step3Content.parentElement!);
  expect(styles?.visibility).toBe("hidden");

  expect(backButton.disabled).toBeFalsy();
  expect(nextButton.disabled).toBeFalsy();
  expect(form.querySelector("#stepped-dialog-submit")).toBeNull();

  expect(back).not.toHaveBeenCalled();
  click(backButton);
  expect(back).toHaveBeenCalledTimes(1);
  back.mockClear();

  rerender(
    <SteppedDialog
      titleId="foo"
      canAdvance={false}
      currentStep={0}
      onBackClick={back}
      onNextClick={next}
      onSubmit={submit}
      onClose={close}
    >
      <Step titleId="step1-title">
        <div id="step1"/>
      </Step>
      <Step titleId="step2-title">
        <div id="step2"/>
      </Step>
      <Step titleId="step3-title">
        <div id="step3"/>
      </Step>
    </SteppedDialog>,
  );

  styles = form.ownerDocument.defaultView?.getComputedStyle(step1Content.parentElement!);
  expect(styles?.visibility).toBe("visible");
  styles = form.ownerDocument.defaultView?.getComputedStyle(step2Content.parentElement!);
  expect(styles?.visibility).toBe("hidden");
  styles = form.ownerDocument.defaultView?.getComputedStyle(step3Content.parentElement!);
  expect(styles?.visibility).toBe("hidden");

  expect(backButton.disabled).toBeTruthy();
  expect(nextButton.disabled).toBeTruthy();
  expect(form.querySelector("#stepped-dialog-submit")).toBeNull();

  rerender(
    <SteppedDialog
      titleId="foo"
      canAdvance={false}
      currentStep={2}
      onBackClick={back}
      onNextClick={next}
      onSubmit={submit}
      onClose={close}
    >
      <Step titleId="step1-title">
        <div id="step1"/>
      </Step>
      <Step titleId="step2-title">
        <div id="step2"/>
      </Step>
      <Step titleId="step3-title">
        <div id="step3"/>
      </Step>
    </SteppedDialog>,
  );

  styles = form.ownerDocument.defaultView?.getComputedStyle(step1Content.parentElement!);
  expect(styles?.visibility).toBe("hidden");
  styles = form.ownerDocument.defaultView?.getComputedStyle(step2Content.parentElement!);
  expect(styles?.visibility).toBe("hidden");
  styles = form.ownerDocument.defaultView?.getComputedStyle(step3Content.parentElement!);
  expect(styles?.visibility).toBe("visible");

  expect(backButton.disabled).toBeFalsy();
  expect(form.querySelector("#stepped-dialog-next")).toBeNull();
  let submitButton = expectChild<HTMLButtonElement>(form, "#stepped-dialog-submit");
  expect(submitButton.disabled).toBeTruthy();

  rerender(
    <SteppedDialog
      titleId="foo"
      canAdvance={true}
      currentStep={2}
      onBackClick={back}
      onNextClick={next}
      onSubmit={submit}
      onClose={close}
    >
      <Step titleId="step1-title">
        <div id="step1"/>
      </Step>
      <Step titleId="step2-title">
        <div id="step2"/>
      </Step>
      <Step titleId="step3-title">
        <div id="step3"/>
      </Step>
    </SteppedDialog>,
  );

  expect(submitButton.disabled).toBeFalsy();

  expect(submit).not.toHaveBeenCalled();
  click(submitButton);
  expect(submit).toHaveBeenCalledTimes(1);

  expect(close).not.toHaveBeenCalled();
  click(cancelButton);
  expect(close).toHaveBeenCalledTimes(1);
});
