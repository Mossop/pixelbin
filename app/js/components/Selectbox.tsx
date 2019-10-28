import React from "react";
import { Localized } from "@fluent/react";

import { L10nProps } from "../l10n";
import { fieldProps, FieldProps } from "./shared";
import Icon, { IconProps } from "./Icon";
import { Property } from "../utils/StateProxy";

export type OptionProps = {
  value: string;
} & L10nProps;

export type SelectboxProps = {
  property: Property<string>;
} & FieldProps & IconProps;

export class Option extends React.Component<OptionProps> {
  public render(): React.ReactNode {
    return <Localized id={this.props.l10n}><option value={this.props.value}/></Localized>;
  }
}

export default class Selectbox extends React.Component<SelectboxProps> {
  private onChange: ((event: React.ChangeEvent<HTMLSelectElement>) => void) = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this.props.property.set(event.target.value);
  };

  public render(): React.ReactNode {
    if (this.props.iconName) {
      return <React.Fragment>
        <span className="field-icon"><Icon iconName={this.props.iconName} iconType={this.props.iconType}/></span>
        <select {...fieldProps(this.props, { className: ["field", "selectfield", "with-icon"] })} value={this.props.property.get()} onChange={this.onChange}>
          {this.props.children}
        </select>
      </React.Fragment>;
    } else {
      return <select {...fieldProps(this.props, { className: ["field", "selectfield"] })} value={this.props.property.get()} onChange={this.onChange}>
        {this.props.children}
      </select>;
    }
  }
}
