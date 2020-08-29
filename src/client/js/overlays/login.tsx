import React, { useCallback, useRef, useState } from "react";

import { login } from "../api/auth";
import FormDialog from "../components/FormDialog";
import { useActions } from "../store/actions";
import { AppError } from "../utils/exception";
import { useFormState } from "../utils/hooks";

export default function LoginOverlay(): React.ReactElement | null {
  const actions = useActions();

  const [state, setState] = useFormState({
    email: "",
    password: "",
  });

  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  let emailInput = useRef<HTMLInputElement>();

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
      setDisabled(false);
      setError(e);
      setState("password", "");

      emailInput.current?.focus();
    }
  }, [actions, state, setState]);

  return <FormDialog
    state={state}
    setState={setState}
    error={error}
    disabled={disabled}
    titleId="login-title"
    submitId="login-submit"
    onSubmit={onSubmit}
    onClose={actions.closeOverlay}
    fields={
      [{
        type: "text",
        key: "email",
        label: "login-email",
        inputType: "email",
        autoComplete: "email",
        props: {
          inputRef: emailInput,
          autoFocus: true,
        },
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
