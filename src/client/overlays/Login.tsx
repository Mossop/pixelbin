import React, { useCallback, useRef, useState } from "react";

import { login } from "../api/auth";
import { FormDialog, TextField, useFormState } from "../components/Forms";
import { useActions } from "../store/actions";
import { AppError } from "../utils/exception";
import { ReactResult } from "../utils/types";

export default function LoginOverlay(): ReactResult {
  const actions = useActions();

  let formState = useFormState({
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
    let { email, password } = formState.value;
    if (!email) {
      return;
    }

    setDisabled(true);
    setError(null);

    try {
      let serverState = await login(email, password);
      actions.completeLogin(serverState);
    } catch (e) {
      setError(e);
      setDisabled(false);
      formState.password.set("");

      emailInput.current?.focus();
    }
  }, [actions, emailInput, formState]);

  return <FormDialog
    id="login"
    error={error}
    disabled={disabled}
    titleId="login-title"
    submitId="login-submit"
    onSubmit={onSubmit}
    onClose={actions.closeOverlay}
    onEntered={onDisplay}
  >
    <TextField
      id="login-email"
      type="email"
      autoComplete="email"
      labelId="login-email"
      state={formState.email}
      ref={emailInput}
    />
    <TextField
      id="login-password"
      type="password"
      autoComplete="current=password"
      labelId="login-password"
      state={formState.password}
    />
  </FormDialog>;
}
