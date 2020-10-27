import { useLocalization } from "@fluent/react";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import React, { forwardRef, useCallback } from "react";

import { FieldState } from "../../utils/state";
import { ReactRef, ReactResult } from "../../utils/types";
import { useFormContext, useUniqueId, useFormStyles } from "./shared";

export interface SelectFieldProps {
  id?: string;
  state: FieldState<string>;
  labelId: string;
  disabled?: boolean;
  required?: boolean;
  onChange?: (value: string) => void;
  children: React.ReactNode;
}

export interface OptionProps<T> {
  value: T;
  children: React.ReactNode;
}

export function Option<T extends string | number>(
  { value, children }: OptionProps<T>,
): ReactResult {
  return <MenuItem value={value}>
    {children}
  </MenuItem>;
}

export default forwardRef(
  function SelectField(
    { id, state, labelId, disabled, required, children, onChange }: SelectFieldProps,
    ref: ReactRef | null,
  ): ReactResult {
    let { l10n } = useLocalization();
    let context = useFormContext();
    let classes = useFormStyles();
    let uniqueId = useUniqueId();

    id ??= uniqueId;
    disabled ||= context.disabled;

    let onSelectChange = useCallback(
      (event: React.ChangeEvent<{ name?: string; value: unknown }>): void => {
        state.set(event.target.value as string);
        if (onChange) {
          onChange(event.target.value as string);
        }
      },
      [onChange, state],
    );

    return <FormControl
      fullWidth={true}
      disabled={disabled}
      required={required}
      className={classes.control}
    >
      <InputLabel htmlFor={id}>{l10n.getString(labelId)}</InputLabel>
      <Select
        id={id}
        ref={ref}
        value={state.value}
        disabled={disabled}
        onChange={onSelectChange}
        required={required}
      >
        {children}
      </Select>
    </FormControl>;
  },
);
