import { useCallback, useRef, useState } from "react";

import { login } from "../api/auth";
import { FormDialog, TextField, useFormState } from "../components/Forms";
import { useActions } from "../store/actions";
import type { AppError } from "../utils/exception";
import type { ReactResult } from "../utils/types";

export default function LoginDialog(): ReactResult {
  let actions = useActions();

  let formState = useFormState({
    email: "",
    password: "",
  });

  let [disabled, setDisabled] = useState(false);
  let [error, setError] = useState<AppError | null>(null);

  let emailInput = useRef<HTMLInputElement>();

  let onDisplay = useCallback(() => {
    emailInput.current?.focus();
  }, [emailInput]);

  let onSubmit = useCallback(async () => {
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
    onClose={actions.closeDialog}
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
      autoComplete="current-password"
      labelId="login-password"
      state={formState.password}
    />
  </FormDialog>;
}
