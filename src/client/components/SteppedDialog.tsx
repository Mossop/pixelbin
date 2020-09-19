import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Step from "@material-ui/core/Step";
import StepLabel from "@material-ui/core/StepLabel";
import Stepper from "@material-ui/core/Stepper";
import { makeStyles, createStyles, Theme } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert/Alert";
import React, { useState, useCallback } from "react";

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
    content: {
      paddingBottom: 0,
    },
    actions: {
      padding: theme.spacing(1),
    },
  }));

export interface Step {
  titleId: string;
  content: ReactResult;
  disabled?: boolean;
  boxClassName?: string;
}

export interface SteppedDialogProps {
  id?: string;
  titleId: string;
  children?: React.ReactNode;
  submitId?: string;
  cancelId?: string;
  nextId?: string;
  currentStep: number;
  onNextClick: () => void;
  onBackClick: () => void;
  backId?: string;
  disabled?: boolean;
  canAdvance?: boolean;
  error?: unknown | null;
  onClose?: () => void;
  onSubmit: () => void;
  steps: Step[];
}

export default function SteppedDialog(props: SteppedDialogProps): ReactResult {
  const { l10n } = useLocalization();
  const classes = useStyles();
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
    <form onSubmit={submit}>
      <DialogTitle id={`${baseId}-title`} className={classes.title}>
        {l10n.getString(props.titleId)}
      </DialogTitle>
      <DialogContent className={classes.content}>
        <Stepper activeStep={props.currentStep} alternativeLabel={true}>
          {
            props.steps.map((step: Step) =>
              <Step key={step.titleId} disabled={step.disabled}>
                <StepLabel>{l10n.getString(step.titleId)}</StepLabel>
              </Step>)
          }
        </Stepper>
        {errorMessage}
        <Box display="grid">
          {
            props.steps.map((step: Step, i: number): ReactResult => <Box
              key={step.titleId}
              visibility={i == props.currentStep ? "visible" : "hidden"}
              gridColumn={1}
              gridArea={1}
              display="flex"
              flexDirection="column"
              justifyContent="start"
              alignItems="stretch"
              className={step.boxClassName}
            >
              {step.content}
            </Box>)
          }
        </Box>
      </DialogContent>
      <DialogActions className={classes.actions}>
        <Button
          id={`${baseId}-cancel`}
          disabled={props.disabled}
          onClick={close}
        >
          {l10n.getString(props.cancelId ?? "form-cancel")}
        </Button>
        <Box flexGrow={1} display="flex" flexDirection="row" justifyContent="flex-end">
          <Button
            id={`${baseId}-back`}
            disabled={props.currentStep == 0 || props.disabled}
            onClick={props.onBackClick}
          >
            {l10n.getString(props.backId ?? "form-back")}
          </Button>
          {
            props.currentStep < props.steps.length - 1
              ? <Button
                id={`${baseId}-next`}
                disabled={props.canAdvance == false || props.disabled}
                onClick={props.onNextClick}
              >
                {l10n.getString(props.nextId ?? "form-next")}
              </Button>
              : <Button
                id={`${baseId}-submit`}
                disabled={props.canAdvance == false || props.disabled}
                type="submit"
              >
                {l10n.getString(props.submitId ?? "form-submit")}
              </Button>
          }
        </Box>
      </DialogActions>
    </form>
  </Dialog>;
}
