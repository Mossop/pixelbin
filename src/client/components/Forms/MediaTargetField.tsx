import { useLocalization } from "@fluent/react";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import React, { forwardRef, useCallback } from "react";

import { MediaTarget } from "../../api/media";
import { FieldState } from "../../utils/state";
import { ReactRef, ReactResult } from "../../utils/types";
import { VirtualItem } from "../../utils/virtual";
import MediaTargetSelect from "../MediaTargetSelect";
import { useFormContext, useUniqueId, useFormStyles } from "./shared";

export interface MediaTargetFieldProps {
  id?: string;
  state: FieldState<MediaTarget>;
  labelId: string;
  disabled?: boolean;
  required?: boolean;
  roots: VirtualItem[];
  onChange?: (value: MediaTarget) => void;
}

export default forwardRef(
  function MediaTargetField(
    { id, state, labelId, required, disabled, roots, onChange }: MediaTargetFieldProps,
    ref: ReactRef | null,
  ): ReactResult {
    let { l10n } = useLocalization();
    let context = useFormContext();
    let classes = useFormStyles();
    let uniqueId = useUniqueId();

    id ??= uniqueId;
    disabled ||= context.disabled;

    let onTargetChange = useCallback((target: MediaTarget): void => {
      state.set(target);
      if (onChange) {
        onChange(target);
      }
    }, [onChange, state]);

    return <FormControl
      fullWidth={true}
      disabled={disabled}
      required={required}
      className={classes.control}
    >
      <InputLabel htmlFor={id}>{l10n.getString(labelId)}</InputLabel>
      <MediaTargetSelect
        id={id}
        ref={ref}
        disabled={disabled}
        required={required}
        roots={roots}
        value={state.value}
        onChange={onTargetChange}
      />
    </FormControl>;
  },
);
