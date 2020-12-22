import { useState, useCallback, useRef } from "react";

import { signup } from "../api/auth";
import { FormDialog, TextField, useFormState } from "../components/Forms";
import { useActions } from "../store/actions";
import type { AppError } from "../utils/exception";
import { closeDialog } from "../utils/navigation";
import type { ReactResult } from "../utils/types";

export default function SignupDialog(): ReactResult {
  let actions = useActions();

  let formState = useFormState({
    email: "",
    fullname: "",
    password: "",
  });

  let [disabled, setDisabled] = useState(false);
  let [error, setError] = useState<AppError | null>(null);

  let emailInput = useRef<HTMLInputElement>();

  let onDisplay = useCallback(() => {
    emailInput.current?.focus();
  }, [emailInput]);

  let onSubmit = useCallback(async (): Promise<void> => {
    let { email, fullname, password } = formState.value;

    if (!email) {
      return;
    }

    setDisabled(true);
    setError(null);

    try {
      let serverState = await signup(
        email,
        password,
        fullname,
      );
      actions.completeSignup(serverState);
    } catch (e) {
      setError(e);
      setDisabled(false);
      formState.password.set("");

      emailInput.current?.focus();
    }
  }, [formState, actions]);

  return <FormDialog
    id="signup"
    error={error}
    disabled={disabled}
    titleId="signup-title"
    submitId="signup-submit"
    onSubmit={onSubmit}
    onClose={closeDialog}
    onEntered={onDisplay}
  >
    <TextField
      id="signup-email"
      type="email"
      autoComplete="email"
      labelId="signup-email"
      state={formState.email}
      ref={emailInput}
    />
    <TextField
      id="signup-fullname"
      labelId="signup-name"
      state={formState.fullname}
    />
    <TextField
      id="signup-password"
      type="password"
      autoComplete="new-password"
      labelId="signup-password"
      state={formState.password}
    />
  </FormDialog>;
}
