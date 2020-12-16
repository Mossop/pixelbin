import { useLocalization } from "@fluent/react";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import { Children, forwardRef, useCallback } from "react";

import type { FieldState } from "../../utils/state";
import type { ReactRef, ReactResult } from "../../utils/types";
import { useFormContext, useUniqueId, useFormStyles } from "./shared";

export interface SelectFieldProps {
  id?: string;
  state: FieldState<string>;
  labelId: string;
  disabled?: boolean;
  required?: boolean;
  onChange?: (value: string) => void;
  children: React.ReactElement<OptionProps> | React.ReactElement<OptionProps>[];
}

export interface OptionProps {
  value: string | number;
  children: React.ReactNode;
}

export function Option(
  { value, children }: OptionProps,
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
        name={id}
        ref={ref}
        value={state.value}
        disabled={disabled}
        onChange={onSelectChange}
        required={required}
      >
        {
          Children.map(children, (child: React.ReactElement<OptionProps>) => {
            return <MenuItem
              key={child.props.value}
              value={child.props.value}
            >{child.props.children}</MenuItem>;
          })
        }
      </Select>
    </FormControl>;
  },
);
