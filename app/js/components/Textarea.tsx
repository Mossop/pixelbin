import React from "react";

import { Property } from "../utils/StateProxy";
import Icon, { IconProps } from "./Icon";
import { fieldProps, FieldProps } from "./shared";

export type TextareaProps = {
  required?: boolean;
  property: Property<string>;
} & FieldProps & IconProps;

export default class Textarea extends React.Component<TextareaProps> {
  private onChange: ((event: React.ChangeEvent<HTMLTextAreaElement>) => void) = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    this.props.property.set(event.target.value || "");
  };

  public render(): React.ReactNode {
    let classes = ["field", "textareafield"];
    if (this.props.iconName) {
      classes.push("with-icon");
    }

    let allProps = {
      ...fieldProps(this.props, { className: classes }),
      required: this.props.required,
      onChange: this.onChange,
      value: this.props.property.get(),
    };

    if (this.props.iconName) {
      return <React.Fragment>
        <span className="field-icon"><Icon iconName={this.props.iconName} iconType={this.props.iconType}/></span>
        <textarea {...allProps}/>
      </React.Fragment>;
    } else {
      return <textarea {...allProps}/>;
    }
  }
}
