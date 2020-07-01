import React, { PureComponent, ReactNode, Fragment } from "react";

import { StyleProps, styleProps } from "../utils/props";
import FieldLabel from "./FieldLabel";
import FormSubmit, { FormSubmitProps } from "./FormSubmit";
import FormTitle, { FormTitleProps } from "./FormTitle";
import Selectbox, { SelectboxProps } from "./Selectbox";
import Textarea, { TextareaProps } from "./Textarea";
import Textbox, { TextboxProps } from "./Textbox";

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

export class FormField extends PureComponent<FormFieldProps> {
  public render(): ReactNode {
    let field = this.props;

    switch (field.type) {
      case "text":
      case "email":
      case "password": {
        return <Fragment>
          <FieldLabel l10n={field.labelL10n} for={field.id}/>
          <div className="fieldBox">
            <Textbox {...field}/>
          </div>
        </Fragment>;
      }
      case "select": {
        return <Fragment>
          <FieldLabel l10n={field.labelL10n} for={field.id}/>
          <div className="fieldBox">
            <Selectbox {...field}>
              {this.props.children}
            </Selectbox>
          </div>
        </Fragment>;
      }
      case "textarea": {
        return <Fragment>
          <FieldLabel l10n={field.labelL10n} for={field.id}/>
          <div className="fieldBox">
            <Textarea {...field}/>
          </div>
        </Fragment>;
      }
    }
  }
}

interface FormFieldsProps {
  fields?: FormFieldProps[];
  disabled?: boolean;
  orientation?: "row" | "column";
}

export class FormFields extends PureComponent<FormFieldsProps> {
  public render(): ReactNode {
    return <div className={`fieldGrid ${this.props.orientation ? this.props.orientation : "row"}`}>
      {
        this.props.fields ?
          this.props.fields.map(
            (field: FormFieldProps): ReactNode =>
              <FormField key={field.id} disabled={this.props.disabled} {...field}/>,
          ) :
          this.props.children
      }
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

export default class Form extends PureComponent<FormProps> {
  private onSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void this.props.onSubmit();
  };

  public render(): ReactNode {
    let title: ReactNode = null;
    let submit: ReactNode = null;

    if (this.props.title) {
      title = typeof this.props.title == "object" ?
        <FormTitle {...this.props.title}/> :
        <FormTitle l10n={this.props.title}/>;
    }
    if (this.props.submit) {
      submit = typeof this.props.submit == "object" ?
        <FormSubmit {...this.props.submit} disabled={this.props.disabled}/> :
        <FormSubmit l10n={this.props.submit} disabled={this.props.disabled}/>;
    }

    return <form {...styleProps(this.props, { className: "form" })} onSubmit={this.onSubmit}>
      {title}
      <FormFields
        orientation={this.props.orientation}
        disabled={this.props.disabled}
        fields={this.props.fields}
      >
        {this.props.children}
      </FormFields>
      {submit}
    </form>;
  }
}
