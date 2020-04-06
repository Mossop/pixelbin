import React, { ReactNode, Fragment, PureComponent } from "react";

import { Property } from "../utils/StateProxy";
import Icon, { IconProps } from "./Icon";
import { fieldProps, FieldProps } from "./shared";

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

    let allProps = {
      ...fieldProps(this.props, { className: classes }),
      required: this.props.required,
      value: this.props.property.get(),
      onChange: this.onChange,
    };

    if (this.props.iconName) {
      return <Fragment>
        <span className="field-icon">
          <Icon iconName={this.props.iconName} iconStyle={this.props.iconStyle}/>
        </span>
        <input {...allProps} type={this.props.type}/>
      </Fragment>;
    } else {
      return <input {...allProps} type={this.props.type}/>;
    }
  }
}
