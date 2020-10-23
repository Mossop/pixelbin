import React, { useCallback, useRef, useState } from "react";

import { login } from "../api/auth";
import FormDialog from "../components/FormDialog";
import FormFields from "../components/FormFields";
import { useActions } from "../store/actions";
import { AppError } from "../utils/exception";
import { useFormState } from "../utils/hooks";
import { ReactResult } from "../utils/types";

export default function LoginOverlay(): ReactResult {
  const actions = useActions();

  const [state, setState] = useFormState({
    email: "",
    password: "",
  });

  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  let emailInput = useRef<HTMLInputElement>();

  const onDisplay = useCallback(() => {
    emailInput.current?.focus();
  }, [emailInput]);

  const onSubmit = useCallback(async () => {
    if (!state.email) {
      return;
    }

    setDisabled(true);
    setError(null);

    try {
      let serverState = await login(state.email, state.password);
      actions.completeLogin(serverState);
    } catch (e) {
      setError(e);
      setDisabled(false);
      setState("password", "");

      emailInput.current?.focus();
    }
  }, [actions, state, setState]);

  return <FormDialog
    error={error}
    disabled={disabled}
    titleId="login-title"
    submitId="login-submit"
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
          ref: emailInput,
          key: "email",
          label: "login-email",
          inputType: "email",
          autoComplete: "email",
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
