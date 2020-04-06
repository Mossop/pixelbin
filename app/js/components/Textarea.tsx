import React, { ReactNode, Fragment, PureComponent } from "react";

import { Property } from "../utils/StateProxy";
import Icon, { IconProps } from "./Icon";
import { fieldProps, FieldProps } from "./shared";

export type TextareaProps = {
  required?: boolean;
  property: Property<string>;
} & FieldProps & IconProps;

export default class Textarea extends PureComponent<TextareaProps> {
  private onChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    this.props.property.set(event.target.value || "");
  };

  public render(): ReactNode {
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
      return <Fragment>
        <span className="field-icon">
          <Icon iconName={this.props.iconName} iconStyle={this.props.iconStyle}/>
        </span>
        <textarea {...allProps}/>
      </Fragment>;
    } else {
      return <textarea {...allProps}/>;
    }
  }
}
