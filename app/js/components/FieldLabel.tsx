import { Localized } from "@fluent/react";
import React, { PureComponent, ReactNode } from "react";

import { L10nProps } from "../l10n";
import { styleProps, StyleProps } from "../utils/props";

type FieldLabelProps = {
  for: string;
} & StyleProps & L10nProps;

export default class FieldLabel extends PureComponent<FieldLabelProps> {
  public render(): ReactNode {
    return <div {...styleProps(this.props, { className: "fieldLabel" })}>
      <Localized id={this.props.l10n}>
        <label htmlFor={this.props.for}/>
      </Localized>
    </div>;
  }
}
