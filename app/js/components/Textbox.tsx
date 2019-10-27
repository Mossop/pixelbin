import React from "react";

import { TextComponent } from "../utils/UIState";
import { UIProps, fieldProps } from "./shared";
import Icon, { IconProps } from "./Icon";

export type TextboxProps = {
  type?: string;
  required?: boolean;
} & UIProps & IconProps;

export default class Textbox extends TextComponent<TextboxProps> {
  private onChange: ((event: React.ChangeEvent<HTMLInputElement>) => void) = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.setUIState(event.target.value);
  };

  public render(): React.ReactNode {
    let classes = ["field", "textfield"];
    if (this.props.iconName) {
      classes.push("with-icon");
    }

    let allProps = {
      ...fieldProps(this.props, { className: classes }),
      required: this.props.required,
      value: this.getUIState(),
      onChange: this.onChange,
    };

    if (this.props.iconName) {
      return <React.Fragment>
        <span className="field-icon"><Icon iconName={this.props.iconName} iconType={this.props.iconType}/></span>
        <input {...allProps} type={this.props.type || "text"}/>
      </React.Fragment>;
    } else {
      return <input {...allProps} type={this.props.type || "text"}/>;
    }
  }
}
