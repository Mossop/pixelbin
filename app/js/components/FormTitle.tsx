import { Localized } from "@fluent/react";
import React from "react";

import { L10nProps } from "../l10n";
import { StyleProps, styleProps } from "./shared";

export type FormTitleProps = StyleProps & L10nProps;

export default class FormTitle extends React.Component<FormTitleProps> {
  public render(): React.ReactNode {
    return <Localized id={this.props.l10n}>
      <p {...styleProps(this.props, { className: "formTitle" })}/>
    </Localized>;
  }
}
