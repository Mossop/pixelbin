import React, { useState, useCallback, useRef } from "react";

import { signup } from "../api/auth";
import FormFields from "../components/FormFields";
import { FormDialog } from "../components/Forms";
import { useActions } from "../store/actions";
import { AppError } from "../utils/exception";
import { useFormState } from "../utils/hooks";
import { ReactResult } from "../utils/types";

export default function SignupOverlay(): ReactResult {
  const actions = useActions();

  const [state, setState] = useFormState({
    email: "",
    fullname: "",
    password: "",
  });

  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  let emailInput = useRef<HTMLInputElement>();

  const onDisplay = useCallback(() => {
    emailInput.current?.focus();
  }, [emailInput]);

  const onSubmit = useCallback(async (): Promise<void> => {
    if (!state.email) {
      return;
    }

    setDisabled(true);
    setError(null);

    try {
      let serverState = await signup(state);
      actions.completeSignup(serverState);
    } catch (e) {
      setError(e);
      setDisabled(false);
      setState("password", "");

      emailInput.current?.focus();
    }
  }, [state, actions, setState]);

  return <FormDialog
    error={error}
    disabled={disabled}
    titleId="signup-title"
    submitId="signup-submit"
    onSubmit={onSubmit}
    onClose={actions.closeOverlay}
    onEntered={onDisplay}
  >
    <FormFields
      id="form-dialog"
      disabled={disabled}
      state={state}
      setState={setState}
      fields={
        [{
          type: "text",
          key: "email",
          ref: emailInput,
          label: "signup-email",
          inputType: "email",
          autoComplete: "email",
        }, {
          type: "text",
          key: "fullname",
          label: "signup-name",
          autoComplete: "name",
        }, {
          type: "text",
          key: "password",
          label: "login-password",
          inputType: "password",
          autoComplete: "current-password",
        }]
      }
    />
  </FormDialog>;
}