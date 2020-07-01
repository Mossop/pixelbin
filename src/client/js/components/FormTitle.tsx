import React, { ReactNode, PureComponent } from "react";

import { L10nProps } from "../l10n";
import { Localized } from "../l10n/Localized";
import { StyleProps, styleProps } from "../utils/props";

export type FormTitleProps = StyleProps & L10nProps;

export default class FormTitle extends PureComponent<FormTitleProps> {
  public render(): ReactNode {
    return <Localized l10n={this.props.l10n}>
      <p {...styleProps(this.props, { className: "formTitle" })}/>
    </Localized>;
  }
}
