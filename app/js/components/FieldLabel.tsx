import React from "react";
import { Localized } from "@fluent/react";

import { L10nProps } from "../l10n";
import { defaultProps, DefaultProps } from "./shared";

type FieldLabelProps = {
  for: string;
} & DefaultProps & L10nProps;

export default class FieldLabel extends React.Component<FieldLabelProps> {
  public render(): React.ReactNode {
    return <p {...defaultProps(this.props, { className: "fieldLabel" })}>
      <Localized id={this.props.l10n}>
        <label htmlFor={this.props.for} />
      </Localized>
    </p>;
  }
}
