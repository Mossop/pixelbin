import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import MuiStep from "@material-ui/core/Step";
import StepLabel from "@material-ui/core/StepLabel";
import Stepper from "@material-ui/core/Stepper";
import type { Theme } from "@material-ui/core/styles";
import { makeStyles, createStyles } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert/Alert";
import React, { useState, useCallback, Children } from "react";

import { errorString } from "../../utils/exception";
import type { ReactResult } from "../../utils/types";
import { Button, SubmitButton } from "./Button";
import type { FormContext } from "./shared";
import { FormContextProvider } from "./shared";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    title: {
      paddingTop: theme.spacing(2),
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
      paddingBottom: 0,
    },
    content: {
      paddingBottom: 0,
    },
    actions: {
      padding: theme.spacing(1),
    },
  }));

export interface StepProps {
  titleId: string;
  children: ReactResult;
  disabled?: boolean;
  className?: string;
}

export function Step({
  children,
}: StepProps): ReactResult {
  return children;
}

export type SteppedDialogProps = FormContext & {
  id?: string;
  titleId: string;
  children: React.ReactElement<StepProps> | React.ReactElement<StepProps>[];
  submitId?: string;
  cancelId?: string;
  backId?: string;
  nextId?: string;
  currentStep: number;
  onNextClick: () => void;
  onBackClick: () => void;
  canAdvance?: boolean;
  error?: unknown | null;
  onClose?: () => void;
  onSubmit: () => void;
};

export default function SteppedDialog({
  id,
  titleId,
  children,
  submitId,
  cancelId,
  backId,
  nextId,
  currentStep,
  onNextClick,
  onBackClick,
  canAdvance,
  error,
  onClose,
  onSubmit,
  canSubmit,
  disabled,
}: SteppedDialogProps): ReactResult {
  let { l10n } = useLocalization();
  let classes = useStyles();
  let [open, setOpen] = useState(true);

  let baseId = id ?? "stepped-dialog";

  let errorMessage = error
    ? <Alert
      id={`${baseId}-error`}
      severity="error"
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

  return <Dialog open={open} onClose={close} scroll="body" aria-labelledby={`${baseId}-title`}>
    <FormContextProvider disabled={disabled} canSubmit={canSubmit}>
      <form onSubmit={submit}>
        <DialogTitle id={`${baseId}-title`} className={classes.title}>
          {l10n.getString(titleId)}
        </DialogTitle>
        <DialogContent className={classes.content}>
          <Stepper activeStep={currentStep} alternativeLabel={true}>
            {
              Children.map(children, (child: React.ReactElement<StepProps>) => {
                return <MuiStep key={child.props.titleId} disabled={child.props.disabled}>
                  <StepLabel>{l10n.getString(child.props.titleId)}</StepLabel>
                </MuiStep>;
              })
            }
          </Stepper>
          {errorMessage}
          <Box display="grid">
            {
              Children.map(children, (child: React.ReactElement<StepProps>, index: number) => {
                return <Box
                  key={child.props.titleId}
                  visibility={index == currentStep ? "visible" : "hidden"}
                  gridColumn={1}
                  gridArea={1}
                  display="flex"
                  flexDirection="column"
                  justifyContent="start"
                  alignItems="stretch"
                  className={child.props.className}
                >
                  {child.props.children}
                </Box>;
              })
            }
          </Box>
        </DialogContent>
        <DialogActions className={classes.actions}>
          <Button
            id={`${baseId}-cancel`}
            onClick={close}
            labelId={cancelId ?? "form-cancel"}
          />
          <Box flexGrow={1} display="flex" flexDirection="row" justifyContent="flex-end">
            <Button
              id={`${baseId}-back`}
              disabled={currentStep == 0}
              onClick={onBackClick}
              labelId={backId ?? "form-back"}
            />
            {
              currentStep < Children.count(children) - 1
                ? <Button
                  id={`${baseId}-next`}
                  disabled={canAdvance == false}
                  onClick={onNextClick}
                  labelId={nextId ?? "form-next"}
                />
                : <SubmitButton
                  id={`${baseId}-submit`}
                  disabled={canAdvance == false}
                  labelId={submitId ?? "form-submit"}
                />
            }
          </Box>
        </DialogActions>
      </form>
    </FormContextProvider>
  </Dialog>;
}
