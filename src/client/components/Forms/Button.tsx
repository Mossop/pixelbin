import { useLocalization } from "@fluent/react";
import MuiButton from "@material-ui/core/Button";
import React, { forwardRef } from "react";

import { ReactRef, ReactResult } from "../../utils/types";
import { useFormContext } from "./shared";

export interface SubmitButtonProps {
  id?: string;
  labelId: string;
  disabled?: boolean;
  onClick?: () => void;
}

export const SubmitButton = forwardRef(
  function SubmitButton(
    { id, labelId, disabled, onClick }: SubmitButtonProps,
    ref: ReactRef | null,
  ): ReactResult {
    let { l10n } = useLocalization();
    let context = useFormContext();

    disabled ||= !(context.canSubmit ?? true) || context.disabled;

    return <MuiButton
      id={id}
      ref={ref}
      disabled={disabled}
      type="submit"
      onClick={onClick}
    >
      {l10n.getString(labelId)}
    </MuiButton>;
  },
);

export interface ButtonProps {
  id?: string;
  labelId: string;
  disabled?: boolean;
  onClick: () => void;
}

export const Button = forwardRef(
  function Button(
    { id, labelId, disabled, onClick }: ButtonProps,
    ref: ReactRef | null,
  ): ReactResult {
    let { l10n } = useLocalization();
    let context = useFormContext();

    disabled ||= context.disabled;

    return <MuiButton
      id={id}
      ref={ref}
      disabled={disabled}
      onClick={onClick}
    >
      {l10n.getString(labelId)}
    </MuiButton>;
  },
);
