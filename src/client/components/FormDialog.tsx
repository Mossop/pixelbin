import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import { createStyles, Theme } from "@material-ui/core/styles";
import makeStyles from "@material-ui/core/styles/makeStyles";
import Alert from "@material-ui/lab/Alert/Alert";
import React, { useCallback, useState } from "react";

import { errorString } from "../utils/exception";
import { ReactResult } from "../utils/types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    title: {
      paddingTop: theme.spacing(2),
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
      paddingBottom: 0,
    },
    error: {
      marginBottom: theme.spacing(2),
    },
    content: {
      paddingBottom: 0,
    },
    actions: {
      padding: theme.spacing(1),
    },
  }));

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
  onEntered?: () => void;
}

export default function FormDialog(props: FormDialogProps): ReactResult {
  const { l10n } = useLocalization();
  const classes = useStyles();
  const [open, setOpen] = useState(true);

  let baseId = props.id ?? "form-dialog";

  let errorMessage = props.error
    ? <Alert
      id={`${baseId}-error`}
      severity="error"
      className={classes.error}
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

  return <Dialog
    open={open}
    onClose={close}
    onEntered={props.onEntered}
    scroll="body"
    aria-labelledby={`${baseId}-title`}
  >
    <form id={props.id} onSubmit={submit}>
      <DialogTitle id={`${baseId}-title`} className={classes.title}>
        {l10n.getString(props.titleId)}
      </DialogTitle>
      <DialogContent className={classes.content}>
        {errorMessage}
        {props.children}
      </DialogContent>
      <DialogActions disableSpacing={true} className={classes.actions}>
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
