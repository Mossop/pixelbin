import { Theme, makeStyles, createStyles } from "@material-ui/core/styles";
import React, { createContext, useContext, useState } from "react";

import { ObjectState, wrapState } from "../../utils/state";
import type { ReactChildren, ReactResult } from "../../utils/types";

export const useFormStyles = makeStyles((theme: Theme) => createStyles({
  control: {
    paddingBottom: theme.spacing(2),
  },
}));

export interface FormState {
  canSubmit?: boolean;
  disabled?: boolean;
}

const Context = createContext<FormState>({
  disabled: false,
});

export function FormContext(props: FormState & ReactChildren): ReactResult {
  let {
    children,
    ...context
  } = props;

  return <Context.Provider value={context}>
    {children}
  </Context.Provider>;
}

export function useFormContext(): FormState {
  return useContext(Context);
}

let id = 1;
export function useUniqueId(base?: string | null): string {
  return useState(`${base ?? "form"}-control${id++}`)[0];
}

export function useFormState<T>(initial: T): ObjectState<T> {
  return wrapState(...useState(initial));
}
