import React from "react";

import { Localized } from "@fluent/react";

import { fieldProps, FieldProps } from "./shared";
import { L10nProps } from "../l10n";
import Icon, { IconProps } from "./Icon";

type ButtonProps  = {
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
} & FieldProps & L10nProps & IconProps;

export class Button extends React.Component<ButtonProps> {
  public render(): React.ReactNode {
    return <button {...fieldProps(this.props, { className: "button" })} onClick={this.props.onClick}>
      <Icon iconType={this.props.iconType} iconName={this.props.iconName}/>
      <Localized id={this.props.l10n}>
        <span/>
      </Localized>
    </button>;
  }
}
