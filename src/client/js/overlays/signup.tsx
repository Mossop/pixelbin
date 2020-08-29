import React, { useState, useCallback, useRef } from "react";

import { signup } from "../api/auth";
import FormDialog from "../components/FormDialog";
import { useActions } from "../store/actions";
import { AppError } from "../utils/exception";
import { useFormState } from "../utils/hooks";

export default function SignupOverlay(): React.ReactElement | null {
  const actions = useActions();

  const [state, setState] = useFormState({
    email: "",
    fullname: "",
    password: "",
  });

  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  let emailInput = useRef<HTMLInputElement>();

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
      setDisabled(false);
      setError(e);
      setState("password", "");

      emailInput.current?.focus();
    }
  }, [state, actions, setState]);

  return <FormDialog
    state={state}
    setState={setState}
    error={error}
    disabled={disabled}
    titleId="signup-title"
    submitId="signup-submit"
    onSubmit={onSubmit}
    onClose={actions.closeOverlay}
    fields={
      [{
        type: "text",
        key: "email",
        label: "signup-email",
        inputType: "email",
        autoComplete: "email",
        props: {
          inputRef: emailInput,
          autoFocus: true,
        },
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
  />;
}