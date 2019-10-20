import React from "react";

import FormTitle, { FormTitleProps } from "../components/FormTitle";
import FieldLabel from "../components/FieldLabel";
import Textbox, { TextboxProps } from "../components/Textbox";
import Selectbox, { SelectboxProps } from "../components/SelectBox";
import FormSubmit, { FormSubmitProps } from "../components/FormSubmit";
import { StyleProps, styleProps } from "../components/shared";

interface LabelProps {
  labelL10n: string;
}

export type TextboxField = {
  fieldType: "textbox";
} & Omit<TextboxProps, "disabled"> & LabelProps;

export type SelectboxField = {
  fieldType: "selectbox";
} & Omit<SelectboxProps, "disabled"> & LabelProps;

export type CustomField = {
  fieldType: "custom";
  content: React.ReactNode;
};

export type Field = TextboxField | SelectboxField | CustomField;

interface FieldsProps {
  fields: Field[];
  orientation?: "row" | "column";
}

export class FormFields extends React.Component<FieldsProps> {
  protected renderField: (field: Field, pos: number) => React.ReactNode = (field: Field, pos: number): React.ReactNode => {
    switch (field.fieldType) {
      case "textbox": {
        return <React.Fragment key={pos}>
          <FieldLabel l10n={field.labelL10n} for={field.uiPath}/>
          <div className="fieldBox">
            <Textbox {...field} id={field.uiPath}/>
          </div>
        </React.Fragment>;
      }
      case "selectbox": {
        return <React.Fragment key={pos}>
          <FieldLabel l10n={field.labelL10n} for={field.uiPath}/>
          <div className="fieldBox">
            <Selectbox {...field} id={field.uiPath}/>
          </div>
        </React.Fragment>;
      }
      case "custom": {
        return <div className="fieldBox custom" key={pos}>{field.content}</div>;
      }
    }
  };

  public render(): React.ReactNode {
    return <div className={`fieldGrid ${this.props.orientation ? this.props.orientation : "row"}`}>
      {this.props.fields.map(this.renderField)}
    </div>;
  }
}

export interface FormProps extends StyleProps {
  disabled: boolean;
  onSubmit: () => void | Promise<void>;

  title?: string | FormTitleProps;
  fields: Field[];
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
      <FormFields fields={this.props.fields}/>
      {submit}
    </form>;
  }
}
