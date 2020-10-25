import { useLocalization } from "@fluent/react";
import FormControl from "@material-ui/core/FormControl";
import Input from "@material-ui/core/Input";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import React from "react";

import { MediaTarget } from "../api/media";
import { ReactResult } from "../utils/types";
import { VirtualItem } from "../utils/virtual";
import MediaTargetField from "./MediaTargetSelect";

type FormKeys<F, T> = {
  [K in keyof F]: F[K] extends T ? K : never;
}[keyof F];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ref<T = any> = React.Ref<T>;

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    control: {
      paddingBottom: theme.spacing(2),
    },
  }));

export interface TextFormField<F> {
  type: "text";
  key: FormKeys<F, string>;
  id?: string;
  ref?: Ref,
  label: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  inputType?: string;
  autoComplete?: string;
  multiline?: boolean;
  required?: boolean;
}

export interface Option {
  value: string;
  label: string;
}

export interface SelectFormField<F> {
  type: "select";
  key: FormKeys<F, string>;
  id?: string;
  ref?: Ref,
  label: string;
  onChange?: (event: React.ChangeEvent<{ name?: string; value: unknown }>) => void;
  options: Option[];
}

export interface MediaTargetFormField<F> {
  type: "mediatarget";
  key: FormKeys<F, MediaTarget>;
  id?: string;
  ref?: Ref,
  label: string;
  roots: VirtualItem[];
  onChange?: (target: MediaTarget) => void;
}

export type FormField<F> = TextFormField<F> | SelectFormField<F> | MediaTargetFormField<F>;

export interface FormFieldProps<T> {
  id?: string;
  disabled?: boolean;
  state: T;
  setState: <K extends keyof T>(key: K, value: T[K]) => void;
  fields: FormField<T>[];
}

export default function FormFields<T>(props: FormFieldProps<T>): ReactResult {
  const { l10n } = useLocalization();
  const classes = useStyles();

  return <React.Fragment>
    {
      props.fields.map((field: FormField<T>): ReactResult => {
        const setState = props.setState;
        let id = `${props.id ?? "dialog"}-${field.id ?? field.key}`;

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (field.type == "mediatarget") {
          let onChange = (target: MediaTarget): void => {
          // @ts-ignore
            setState(field.key, target);
            if (field.onChange) {
              field.onChange(target);
            }
          };

          return <FormControl
            fullWidth={true}
            disabled={props.disabled}
            key={`field-${field.key}`}
            className={classes.control}
          >
            <InputLabel htmlFor={id}>{l10n.getString(field.label)}</InputLabel>
            <MediaTargetField
              id={id}
              ref={field.ref}
              disabled={props.disabled}
              roots={field.roots}
              value={props.state[field.key] as unknown as MediaTarget}
              onChange={onChange}
            />
          </FormControl>;
        } else if (field.type == "select") {
          let onChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>): void => {
          // @ts-ignore
            setState(field.key, event.target.value);
            if (field.onChange) {
              field.onChange(event);
            }
          };

          return <FormControl
            fullWidth={true}
            disabled={props.disabled}
            key={`field-${field.key}`}
            className={classes.control}
          >
            <InputLabel htmlFor={id}>{l10n.getString(field.label)}</InputLabel>
            <Select
              id={id}
              ref={field.ref}
              value={props.state[field.key]}
              disabled={props.disabled}
              onChange={onChange}
            >
              {
                field.options.map((option: Option): ReactResult => <MenuItem
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </MenuItem>)
              }
            </Select>
          </FormControl>;
        } else {
          // field.type == "text"

          let onChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
          // @ts-ignore
            setState(field.key, event.target.value);
            if (field.onChange) {
              field.onChange(event);
            }
          };

          return <FormControl
            fullWidth={true}
            disabled={props.disabled}
            key={`field-${field.key}`}
            className={classes.control}
          >
            <InputLabel htmlFor={id}>{l10n.getString(field.label)}</InputLabel>
            <Input
              id={id}
              inputRef={field.ref}
              disabled={props.disabled}
              required={field.required}
              value={props.state[field.key]}
              multiline={field.multiline}
              type={field.inputType}
              autoComplete={field.autoComplete}
              onChange={onChange}
            />
          </FormControl>;
        }
      })
    }
  </React.Fragment>;
}
