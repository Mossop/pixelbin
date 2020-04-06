import { Localized } from "@fluent/react";
import React, { ReactNode, Fragment, PureComponent } from "react";

import { L10nProps } from "../l10n";
import { Property } from "../utils/StateProxy";
import Icon, { IconProps } from "./Icon";
import { fieldProps, FieldProps } from "./shared";

export type OptionProps = {
  value: string;
} & L10nProps;

export type SelectboxProps = {
  property: Property<string>;
} & FieldProps & IconProps;

export class Option extends PureComponent<OptionProps> {
  public render(): ReactNode {
    return <Localized id={this.props.l10n}><option value={this.props.value}/></Localized>;
  }
}

export default class Selectbox extends PureComponent<SelectboxProps> {
  private onChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this.props.property.set(event.target.value);
  };

  public render(): ReactNode {
    if (this.props.iconName) {
      return <Fragment>
        <span className="field-icon">
          <Icon iconName={this.props.iconName} iconStyle={this.props.iconStyle}/>
        </span>
        <select
          {...fieldProps(this.props, { className: ["field", "selectfield", "with-icon"] })}
          value={this.props.property.get()}
          onChange={this.onChange}
        >
          {this.props.children}
        </select>
      </Fragment>;
    } else {
      return <select
        {...fieldProps(this.props, { className: ["field", "selectfield"] })}
        value={this.props.property.get()}
        onChange={this.onChange}
      >
        {this.props.children}
      </select>;
    }
  }
}
