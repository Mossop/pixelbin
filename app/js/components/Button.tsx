import React from "react";

import { Localized } from "@fluent/react";

import { fieldProps, FieldProps } from "./shared";
import { L10nProps } from "../l10n";

type ButtonProps  = {
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
} & FieldProps & L10nProps;

export class Button extends React.Component<ButtonProps> {
  public render(): React.ReactNode {
    return (
      <button {...fieldProps(this.props)} onClick={this.props.onClick}>
        <Localized id={this.props.l10n}>
          <span/>
        </Localized>
      </button>
    );
  }
}
