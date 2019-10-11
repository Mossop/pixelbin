import React from "react";
import { Localized } from "@fluent/react";

import { L10nProps } from "../l10n";
import { DefaultProps, defaultProps } from "./shared";

export type FormTitleProps = DefaultProps & L10nProps;

export default class FormTitle extends React.Component<FormTitleProps> {
  public render(): React.ReactNode {
    return <Localized id={this.props.l10n}>
      <p {...defaultProps(this.props, { className: "formTitle" })}/>
    </Localized>;
  }
}
