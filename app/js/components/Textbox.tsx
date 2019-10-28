import React from "react";

import { fieldProps, FieldProps } from "./shared";
import Icon, { IconProps } from "./Icon";
import { InputState } from "../utils/InputState";

export type TextboxProps = {
  type: "text" | "email" | "password";
  required?: boolean;
  inputs: InputState<string>;
} & FieldProps & IconProps;

export default class Textbox extends React.Component<TextboxProps> {
  private onChange: ((event: React.ChangeEvent<HTMLInputElement>) => void) = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.props.inputs.setInputValue(event.target.value);
  };

  public render(): React.ReactNode {
    let classes = ["field", "textfield"];
    if (this.props.iconName) {
      classes.push("with-icon");
    }

    let allProps = {
      ...fieldProps(this.props, { className: classes }),
      required: this.props.required,
      value: this.props.inputs.getInputValue(),
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
