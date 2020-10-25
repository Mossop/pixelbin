import { useLocalization } from "@fluent/react";
import FormControl from "@material-ui/core/FormControl";
import Input from "@material-ui/core/Input";
import InputLabel from "@material-ui/core/InputLabel";
import React, { forwardRef, useCallback } from "react";

import { FieldState } from "../../utils/state";
import { ReactRef, ReactResult } from "../../utils/types";
import { useFormContext, useUniqueId, useFormStyles } from "./shared";

export interface TextFieldProps {
  id?: string;
  state: FieldState<string>;
  labelId: string;
  disabled?: boolean;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  onChange?: (value: string) => void;
}

export default forwardRef(
  function TextField(
    { id, state, labelId, disabled, required, type, autoComplete, onChange }: TextFieldProps,
    ref: ReactRef | null,
  ): ReactResult {
    let { l10n } = useLocalization();
    let context = useFormContext();
    let classes = useFormStyles();
    let uniqueId = useUniqueId();
    let onInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
      state.set(event.target.value);
      if (onChange) {
        onChange(event.target.value);
      }
    }, [onChange, state]);

    id ??= uniqueId;
    disabled ||= context.disabled;

    return <FormControl
      fullWidth={true}
      disabled={disabled}
      required={required}
      className={classes.control}
    >
      <InputLabel htmlFor={id}>{l10n.getString(labelId)}</InputLabel>
      <Input
        id={id}
        inputRef={ref}
        value={state.value}
        type={type ?? "text"}
        autoComplete={autoComplete}
        onChange={onInputChange}
      />
    </FormControl>;
  },
);
