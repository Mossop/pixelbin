import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import Dialog from "@material-ui/core/Dialog/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import type { Theme } from "@material-ui/core/styles";
import { createStyles } from "@material-ui/core/styles";
import makeStyles from "@material-ui/core/styles/makeStyles";
import Alert from "@material-ui/lab/Alert/Alert";
import React, { useCallback, useState } from "react";

import { errorString } from "../../utils/exception";
import type { ReactResult } from "../../utils/types";
import { Button } from "./Button";
import { FormContextProvider } from "./shared";

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

export interface ConfirmationDialogProps {
  id?: string;
  titleId: string;
  children?: React.ReactNode;
  submitId?: string;
  cancelId?: string;
  disabled?: boolean;
  error?: unknown | null;
  onClose?: () => void;
  onAccept: () => void;
}

export default function ConfirmationDialog({
  id,
  titleId,
  children,
  submitId,
  cancelId,
  disabled,
  error,
  onClose,
  onAccept,
}: ConfirmationDialogProps): ReactResult {
  let { l10n } = useLocalization();
  let classes = useStyles();
  let [open, setOpen] = useState(true);

  let baseId = id ?? "confirm-dialog";

  let errorMessage = error
    ? <Alert
      id={`${baseId}-error`}
      severity="error"
      className={classes.error}
    >
      {errorString(l10n, error)}
    </Alert>
    : null;

  let accept = useCallback((): void => {
    onAccept();
  }, [onAccept]);

  let close = useCallback(() => {
    setOpen(false);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  return <Dialog
    open={open}
    onClose={close}
    scroll="body"
    aria-labelledby={`${baseId}-title`}
  >
    <FormContextProvider disabled={disabled}>
      <DialogTitle id={`${baseId}-title`} className={classes.title}>
        {l10n.getString(titleId)}
      </DialogTitle>
      <DialogContent className={classes.content}>
        {errorMessage}
        {children}
      </DialogContent>
      <DialogActions disableSpacing={true} className={classes.actions}>
        <Button
          id={`${baseId}-cancel`}
          onClick={close}
          labelId={cancelId ?? "confirm-cancel"}
        />
        <Box flexGrow={1} display="flex" flexDirection="row" justifyContent="flex-end">
          <Button
            id={`${baseId}-accept`}
            disabled={disabled}
            onClick={accept}
            labelId={submitId ?? "confirm-accept"}
          />
        </Box>
      </DialogActions>
    </FormContextProvider>
  </Dialog>;
}
