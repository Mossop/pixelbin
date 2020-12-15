import { useLocalization } from "@fluent/react";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import React, { forwardRef, useCallback } from "react";

import type { Catalog } from "../../api/highlevel";
import type { MediaTarget } from "../../api/media";
import type { FieldState } from "../../utils/state";
import type { ReactRef, ReactResult } from "../../utils/types";
import MediaContainerSelect from "../MediaContainerSelect";
import { useFormContext, useUniqueId, useFormStyles } from "./shared";

export interface MediaTargetFieldProps {
  id?: string;
  state: FieldState<MediaTarget>;
  labelId: string;
  currentTarget?: string | null;
  disabled?: boolean;
  required?: boolean;
  catalogs: Catalog[];
  onChange?: (value: MediaTarget) => void;
}

export default forwardRef(function MediaTargetField({
  id,
  state,
  labelId,
  required,
  disabled,
  catalogs,
  currentTarget,
  onChange,
}: MediaTargetFieldProps, ref: ReactRef | null): ReactResult {
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
    <MediaContainerSelect
      id={id}
      ref={ref}
      disabled={disabled}
      required={required}
      catalogs={catalogs}
      value={state.value}
      currentTarget={currentTarget}
      onChange={onTargetChange}
    />
  </FormControl>;
});
