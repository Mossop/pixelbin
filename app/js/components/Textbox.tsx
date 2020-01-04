import React from "react";

import { Property } from "../utils/StateProxy";
import { fieldProps, FieldProps } from "./shared";
import Icon, { IconProps } from "./Icon";

export type TextboxProps = {
  type: "text" | "email" | "password";
  required?: boolean;
  property: Property<string>;
} & FieldProps & IconProps;

export default class Textbox extends React.Component<TextboxProps> {
  private onChange: ((event: React.ChangeEvent<HTMLInputElement>) => void) = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.props.property.set(event.target.value);
  };

  public render(): React.ReactNode {
    let classes = ["field", "textfield"];
    if (this.props.iconName) {
      classes.push("with-icon");
    }

    let allProps = {
      ...fieldProps(this.props, { className: classes }),
      required: this.props.required,
      value: this.props.property.get(),
      onChange: this.onChange,
    };

    if (this.props.iconName) {
      return <React.Fragment>
        <span className="field-icon"><Icon iconName={this.props.iconName} iconType={this.props.iconType}/></span>
        <input {...allProps} type={this.props.type}/>
      </React.Fragment>;
    } else {
      return <input {...allProps} type={this.props.type}/>;
    }
  }
}
