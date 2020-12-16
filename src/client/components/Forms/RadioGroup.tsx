import { useLocalization } from "@fluent/react";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import MuiRadio from "@material-ui/core/Radio";
import { createContext, useCallback, useContext } from "react";

import type { FieldState } from "../../utils/state";
import type { ReactChildren, ReactResult } from "../../utils/types";
import { useFormContext } from "./shared";

interface RadioContext<T> {
  disabled?: boolean;
  name: string;
  state: FieldState<T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RadioGroupContext = createContext<RadioContext<any> | null>(null);

export function RadioGroup<T>(props: RadioContext<T> & ReactChildren): ReactResult {
  let {
    children,
    ...context
  } = props;
  return <RadioGroupContext.Provider value={context}>
    {children}
  </RadioGroupContext.Provider>;
}

interface RadioProps<T> {
  id?: string;
  disabled?: boolean;
  labelId: string;
  value: T;
}

export function Radio<T>({
  id,
  disabled,
  labelId,
  value,
}: RadioProps<T>): ReactResult {
  let { l10n } = useLocalization();
  let formContext = useFormContext();
  disabled ||= formContext.disabled;

  let radioContext = useContext(RadioGroupContext) as RadioContext<T> | null;
  if (!radioContext) {
    throw new Error("Must provide a RadioGroup for a Radio.");
  }

  disabled ||= radioContext.disabled;
  let { name, state } = radioContext;

  let onChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      state.set(value);
    }
  }, [state, value]);

  return <FormControlLabel
    disabled={disabled}
    label={l10n.getString(labelId)}
    control={
      <MuiRadio
        id={id}
        checked={state.value == value}
        name={name}
        value={value}
        onChange={onChange}
      />
    }
  />;
}
