import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import Dialog from "@material-ui/core/Dialog/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import type { Theme } from "@material-ui/core/styles";
import { createStyles } from "@material-ui/core/styles";
import makeStyles from "@material-ui/core/styles/makeStyles";
import Alert from "@material-ui/lab/Alert/Alert";
import { useCallback, useState } from "react";

import { errorString } from "../../utils/exception";
import type { ReactResult } from "../../utils/types";
import { Button, SubmitButton } from "./Button";
import DialogTitle from "./DialogTitle";
import type { FormContext } from "./shared";
import { FormContextProvider } from "./shared";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    error: {
      marginBottom: theme.spacing(2),
    },
  }));

export type FormDialogProps = FormContext & {
  id?: string;
  titleId: string;
  children?: React.ReactNode;
  submitId?: string;
  cancelId?: string;
  error?: unknown | null;
  onClose?: () => void;
  onSubmit: () => void;
  onEntered?: () => void;
};

export default function FormDialog({
  id,
  titleId,
  submitId,
  cancelId,
  error,
  onClose,
  onSubmit,
  onEntered,
  disabled,
  canSubmit,
  children,
}: FormDialogProps): ReactResult {
  let { l10n } = useLocalization();
  let classes = useStyles();
  let [open, setOpen] = useState(true);

  let baseId = id ?? "form-dialog";

  let errorMessage = error
    ? <Alert
      id={`${baseId}-error`}
      severity="error"
      className={classes.error}
    >
      {errorString(l10n, error)}
    </Alert>
    : null;

  let submit = useCallback((event: React.FormEvent): void => {
    event.preventDefault();
    onSubmit();
  }, [onSubmit]);

  let close = useCallback(() => {
    setOpen(false);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  return <Dialog
    open={open}
    onClose={close}
    onEntered={onEntered}
    scroll="body"
    aria-labelledby={`${baseId}-title`}
  >
    <FormContextProvider disabled={disabled} canSubmit={canSubmit}>
      <form id={id} onSubmit={submit}>
        <DialogTitle id={`${baseId}-title`} title={l10n.getString(titleId)}/>
        <DialogContent>
          {errorMessage}
          {children}
        </DialogContent>
        <DialogActions>
          <Button
            id={`${baseId}-cancel`}
            onClick={close}
            labelId={cancelId ?? "form-cancel"}
          />
          <Box flexGrow={1} display="flex" flexDirection="row" justifyContent="flex-end">
            <SubmitButton
              id={`${baseId}-submit`}
              labelId={submitId ?? "form-submit"}
            />
          </Box>
        </DialogActions>
      </form>
    </FormContextProvider>
  </Dialog>;
}
