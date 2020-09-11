import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Alert from "@material-ui/lab/Alert/Alert";
import React, { useCallback, useState } from "react";

import { errorString } from "../utils/exception";
import { ReactResult } from "../utils/types";

export interface FormDialogProps {
  id?: string;
  titleId: string;
  children?: React.ReactNode;
  submitId?: string;
  cancelId?: string;
  canSubmit?: boolean;
  disabled?: boolean;
  error?: unknown | null;
  onClose?: () => void;
  onSubmit: () => void;
}

export default function FormDialog(props: FormDialogProps): ReactResult {
  const { l10n } = useLocalization();
  const [open, setOpen] = useState(true);

  let baseId = props.id ?? "dialog";

  let errorMessage = props.error
    ? <Alert
      id={`${baseId}-error`}
      severity="error"
    >
      {errorString(l10n, props.error)}
    </Alert>
    : null;

  const submit = useCallback((event: React.FormEvent): void => {
    event.preventDefault();
    props.onSubmit();
  }, [props]);

  const close = useCallback(() => {
    setOpen(false);
    if (props.onClose) {
      props.onClose();
    }
  }, [props]);

  return <Dialog open={open} onClose={close} scroll="body" aria-labelledby={`${baseId}-title`}>
    <form id={props.id} onSubmit={submit}>
      <DialogTitle id={`${baseId}-title`}>
        {l10n.getString(props.titleId)}
      </DialogTitle>
      <DialogContent>
        {errorMessage}
        {props.children}
      </DialogContent>
      <DialogActions>
        <Button
          id={`${baseId}-cancel`}
          disabled={props.disabled}
          onClick={close}
        >
          {l10n.getString(props.cancelId ?? "form-cancel")}
        </Button>
        <Box flexGrow={1} display="flex" flexDirection="row" justifyContent="flex-end">
          <Button
            id={`${baseId}-submit`}
            disabled={props.canSubmit === false || props.disabled}
            type="submit"
          >
            {l10n.getString(props.submitId ?? "form-submit")}
          </Button>
        </Box>
      </DialogActions>
    </form>
  </Dialog>;
}
