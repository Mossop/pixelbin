import React from "react";
import { Localized } from "@fluent/react";

import { L10nProps } from "../l10n";
import { styleProps, StyleProps } from "./shared";

type FieldLabelProps = {
  for: string;
} & StyleProps & L10nProps;

export default class FieldLabel extends React.Component<FieldLabelProps> {
  public render(): React.ReactNode {
    return <p {...styleProps(this.props, { className: "fieldLabel" })}>
      <Localized id={this.props.l10n}>
        <label htmlFor={this.props.for} />
      </Localized>
    </p>;
  }
}
