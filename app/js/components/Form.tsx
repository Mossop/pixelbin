import React from "react";

import FormTitle, { FormTitleProps } from "./FormTitle";
import FieldLabel from "./FieldLabel";
import Textbox, { TextboxProps } from "./Textbox";
import Selectbox, { SelectboxProps } from "./Selectbox";
import FormSubmit, { FormSubmitProps } from "./FormSubmit";
import { StyleProps, styleProps } from "./shared";
import Textarea, { TextareaProps } from "./Textarea";

interface LabelProps {
  id: string;
  labelL10n: string;
}

export type TextboxFieldProps = TextboxProps & LabelProps;

export type SelectboxFieldProps = {
  type: "select";
} & SelectboxProps & LabelProps;

export type TextareaFieldProps = {
  type: "textarea";
} & TextareaProps & LabelProps;

export type FormFieldProps = TextboxFieldProps | SelectboxFieldProps | TextareaFieldProps;

export class FormField extends React.Component<FormFieldProps> {
  public render(): React.ReactNode {
    let field = this.props;

    switch (field.type) {
      case "text":
      case "email":
      case "password": {
        return <React.Fragment>
          <FieldLabel l10n={field.labelL10n} for={field.id}/>
          <div className="fieldBox">
            <Textbox {...field}/>
          </div>
        </React.Fragment>;
      }
      case "select": {
        return <React.Fragment>
          <FieldLabel l10n={field.labelL10n} for={field.id}/>
          <div className="fieldBox">
            <Selectbox {...field}>
              {this.props.children}
            </Selectbox>
          </div>
        </React.Fragment>;
      }
      case "textarea": {
        return <React.Fragment>
          <FieldLabel l10n={field.labelL10n} for={field.id}/>
          <div className="fieldBox">
            <Textarea {...field}/>
          </div>
        </React.Fragment>;
      }
    }
  }
}

interface FormFieldsProps {
  fields?: FormFieldProps[];
  disabled?: boolean;
  orientation?: "row" | "column";
}

export class FormFields extends React.Component<FormFieldsProps> {
  public render(): React.ReactNode {
    return <div className={`fieldGrid ${this.props.orientation ? this.props.orientation : "row"}`}>
      {this.props.fields ? this.props.fields.map((field: FormFieldProps) => <FormField key={field.id} disabled={this.props.disabled} {...field}/>) : this.props.children}
    </div>;
  }
}

export interface FormProps extends StyleProps {
  disabled?: boolean;
  onSubmit: () => void | Promise<void>;

  title?: string | FormTitleProps;
  orientation?: "row" | "column";
  fields?: FormFieldProps[];
  submit?: string | Omit<FormSubmitProps, "disabled">;
}

export default class Form extends React.Component<FormProps> {
  private onSubmit: ((event: React.FormEvent<HTMLFormElement>) => void) = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    this.props.onSubmit();
  };

  public render(): React.ReactNode {
    let title: React.ReactNode = null;
    let submit: React.ReactNode = null;

    if (this.props.title) {
      title = typeof this.props.title == "object" ?
        <FormTitle {...this.props.title}/> :
        <FormTitle l10n={this.props.title }/>;
    }
    if (this.props.submit) {
      submit = typeof this.props.submit == "object" ?
        <FormSubmit {...this.props.submit} disabled={this.props.disabled}/> :
        <FormSubmit l10n={this.props.submit} disabled={this.props.disabled}/>;
    }

    return <form {...styleProps(this.props, { className: "form" })} onSubmit={this.onSubmit}>
      {title}
      <FormFields orientation={this.props.orientation} disabled={this.props.disabled} fields={this.props.fields}>
        {this.props.children}
      </FormFields>
      {submit}
    </form>;
  }
}
