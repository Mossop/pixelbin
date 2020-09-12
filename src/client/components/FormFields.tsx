import { useLocalization } from "@fluent/react";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import TextField, { TextFieldProps } from "@material-ui/core/TextField";
import React from "react";

import { MediaTarget } from "../api/media";
import { ReactResult } from "../utils/types";
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
  required?: boolean;
  props?: Partial<TextFieldProps>;
}

export interface Option {
  value: string;
  label: string;
}

export interface SelectFormField<F> {
  type: "select";
  key: FormKeys<F, string>;
  id?: string;
  label: string;
  onChange?: (event: React.ChangeEvent<{ name?: string; value: unknown }>) => void;
  options: Option[];
}

export interface MediaTargetFormField<F> {
  type: "mediatarget";
  key: FormKeys<F, MediaTarget>;
  id?: string;
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

  return <React.Fragment>
    {
      props.fields.map((field: FormField<T>): ReactResult => {
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
            disabled={props.disabled}
            key={`field-${field.key}`}
            roots={field.roots}
            fullWidth={true}
            margin="normal"
            value={props.state[field.key] as unknown as MediaTarget}
            onChange={onChange}
            label={l10n.getString(field.label)}
          />;
        } else if (field.type == "select") {
          let onChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>): void => {
          // @ts-ignore: TypeScript can't tell that this must be a string.
            setState(field.key, event.target.value);
            if (field.onChange) {
              field.onChange(event);
            }
          };

          return <FormControl
            disabled={props.disabled}
            key={`field-${field.key}`}
          >
            <InputLabel id={`${id}-label`}>{l10n.getString(field.label)}</InputLabel>
            <Select
              labelId={`${id}-label`}
              id={id}
              value={props.state[field.key]}
              disabled={props.disabled}
              fullWidth={true}
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
            disabled={props.disabled}
            required={field.required}
            label={l10n.getString(field.label)}
            value={props.state[field.key]}
            multiline={field.multiline}
            type={field.inputType}
            autoComplete={field.autoComplete}
            onChange={onChange}
            {...field.props}
          />;
        }
      })
    }
  </React.Fragment>;
}
