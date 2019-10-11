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

export interface FormProps extends StyleProps {
  disabled: boolean;
  onSubmit: () => void | Promise<void>;

  title: string | FormTitleProps;
  fields: Field[];
  submit: string | Omit<FormSubmitProps, "disabled">;
}

export default class Form extends React.Component<FormProps> {
  private onSubmit: ((event: React.FormEvent<HTMLFormElement>) => void) = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    this.props.onSubmit();
  };

  public renderField: (field: Field, pos: number) => React.ReactNode = (field: Field, pos: number): React.ReactNode => {
    switch (field.fieldType) {
      case "textbox": {
        return <React.Fragment key={pos}>
          <FieldLabel l10n={field.labelL10n} for={field.uiPath}/>
          <Textbox {...field} id={field.uiPath}/>
        </React.Fragment>;
      }
      case "selectbox": {
        return <React.Fragment key={pos}>
          <FieldLabel l10n={field.labelL10n} for={field.uiPath}/>
          <Selectbox {...field} id={field.uiPath}/>
        </React.Fragment>;
      }
      case "custom": {
        return <React.Fragment key={pos}>{field.content}</React.Fragment>;
      }
    }
  };

  public render(): React.ReactNode {
    let title = typeof this.props.title == "object" ? this.props.title : { l10n: this.props.title };
    let submit = typeof this.props.submit == "object" ? this.props.submit : { l10n: this.props.submit };

    return <form {...styleProps(this.props, { className: "fieldGrid" })} onSubmit={this.onSubmit}>
      <FormTitle {...title}/>
      {this.props.fields.map(this.renderField)}
      <FormSubmit {...submit} disabled={this.props.disabled}/>
    </form>;
  }
}
