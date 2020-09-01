import { useLocalization } from "@fluent/react";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import TextField, { TextFieldProps } from "@material-ui/core/TextField";
import Alert from "@material-ui/lab/Alert/Alert";
import React, { useCallback, useState } from "react";

import { MediaTarget } from "../api/media";
import { AppError } from "../utils/exception";
import { VirtualItem } from "../utils/virtual";
import MediaTargetField from "./MediaTargetField";

type FormKeys<F, T> = {
  [K in keyof F]: F[K] extends T ? K : never;
}[keyof F];

export interface TextFormField<F> {
  type: "text";
  key: FormKeys<F, string>;
  id?: string;
  label: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  inputType?: string;
  autoComplete?: string;
  multiline?: boolean;
  props?: Partial<TextFieldProps>;
}

export interface MediaTargetFormField<F> {
  type: "mediatarget";
  key: FormKeys<F, MediaTarget>;
  id?: string;
  label: string;
  roots: VirtualItem[];
  onChange?: (target: MediaTarget) => void;
}

export type FormField<F> = TextFormField<F> | MediaTargetFormField<F>;

export interface FormDialogProps<T> {
  id?: string;
  titleId: string;
  state?: T;
  setState?: <K extends keyof T>(key: K, value: T[K]) => void;
  children?: React.ReactNode;
  submitId?: string;
  cancelId?: string;
  disabled?: boolean;
  error?: AppError | null;
  onClose?: () => void;
  onSubmit: () => void;
  fields?: FormField<T>[];
}

export default function FormDialog<T = undefined>(
  props: FormDialogProps<T>,
): React.ReactElement | null {
  const { l10n } = useLocalization();
  const [open, setOpen] = useState(true);

  let errorMessage = props.error ?
    <Alert
      id={`${props.id ?? "dialog"}-error`}
      severity="error"
    >
      {props.error.asString(l10n)}
    </Alert> :
    null;

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

  const renderField = useCallback(
    (field: FormField<T>): React.ReactElement | null => {
      if (!props.state || !props.setState) {
        return null;
      }

      const setState = props.setState;
      let id = `${props.id ?? "dialog"}-${field.id ?? field.key}`;

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (field.type == "mediatarget") {
        let onChange = (target: MediaTarget): void => {
          // @ts-ignore: TypeScript can't tell that this must be a string.
          setState(field.key, target);
          if (field.onChange) {
            field.onChange(target);
          }
        };

        return <MediaTargetField
          id={id}
          key={`field-${field.key}`}
          roots={field.roots}
          fullWidth={true}
          margin="normal"
          value={props.state[field.key] as unknown as MediaTarget}
          onChange={onChange}
          label={l10n.getString(field.label)}
        />;
      } else {
        // field.type == "text"

        let onChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
          // @ts-ignore: TypeScript can't tell that this must be a string.
          setState(field.key, event.target.value);
          if (field.onChange) {
            field.onChange(event);
          }
        };

        return <TextField
          id={id}
          key={`field-${field.key}`}
          fullWidth={true}
          margin="normal"
          disabled={props.disabled}
          label={l10n.getString(field.label)}
          value={props.state[field.key]}
          multiline={field.multiline}
          type={field.inputType}
          autoComplete={field.autoComplete}
          onChange={onChange}
          {...field.props}
        />;
      }
    },
    // See https://github.com/typescript-eslint/typescript-eslint/milestone/7.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props, l10n],
  );

  return <Dialog open={open} onClose={close} aria-labelledby="dialog-title">
    <form id={props.id} onSubmit={submit}>
      <DialogTitle id="dialog-title">{l10n.getString(props.titleId)}</DialogTitle>
      <DialogContent>
        {errorMessage}
        {props.children}
        {props.fields?.map(renderField)}
      </DialogContent>
      <DialogActions>
        <Button
          id={`${props.id ?? "dialog"}-submit`}
          disabled={props.disabled}
          type="submit"
        >
          {l10n.getString(props.submitId ?? "form-submit")}
        </Button>
        <Button
          id={`${props.id ?? "dialog"}-cancel`}
          disabled={props.disabled}
          onClick={close}
        >
          {l10n.getString(props.cancelId ?? "form-cancel")}
        </Button>
      </DialogActions>
    </form>
  </Dialog>;
}
