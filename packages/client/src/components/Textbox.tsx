import React, { ReactNode, Fragment, PureComponent } from "react";

import { fieldProps, FieldProps } from "../utils/props";
import { Property } from "../utils/StateProxy";
import Icon, { IconProps } from "./Icon";

export type TextboxProps = {
  type: "text" | "email" | "password";
  required?: boolean;
  property: Property<string>;
} & FieldProps & IconProps;

export default class Textbox extends PureComponent<TextboxProps> {
  private onChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.props.property.set(event.target.value);
  };

  public render(): ReactNode {
    let classes = ["field", "textfield"];
    if (this.props.iconName) {
      classes.push("with-icon");
    }

    let inputProps = {
      ...fieldProps(this.props, { className: classes }),
      type: this.props.type,
      required: this.props.required,
      value: this.props.property.get(),
      onChange: this.onChange,
    };

    if (this.props.iconName) {
      return <Fragment>
        <span className="field-icon">
          <Icon iconName={this.props.iconName} iconStyle={this.props.iconStyle}/>
        </span>
        <input {...inputProps}/>
      </Fragment>;
    } else {
      return <input {...inputProps}/>;
    }
  }
}
