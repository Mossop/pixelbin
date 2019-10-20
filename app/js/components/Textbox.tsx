import React from "react";

import { TextComponent } from "../utils/UIState";
import { UIProps, fieldProps } from "./shared";

export type TextboxProps = {
  type?: string;
  required?: boolean;
} & UIProps;

export default class Textbox extends TextComponent<TextboxProps> {
  private onChange: ((event: React.ChangeEvent<HTMLInputElement>) => void) = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.setUIState(event.target.value);
  };

  public render(): React.ReactNode {
    return (
      <input {...fieldProps(this.props, { className: ["field", "textfield"] })} type={this.props.type || "text"} required={this.props.required} value={this.getUIState()} onChange={this.onChange}/>
    );
  }
}
