import { Localized } from "@fluent/react";
import React, { PureComponent, ReactNode } from "react";

import { L10nProps } from "../l10n";
import { styleProps, FieldProps } from "./shared";

export type FormSubmitProps = FieldProps & L10nProps;

export default class FormSubmit extends PureComponent<FormSubmitProps> {
  public render(): ReactNode {
    return <div {...styleProps(this.props, { className: ["formSubmit"] })}>
      <Localized id={this.props.l10n}>
        <button type="button" disabled={this.props.disabled}/>
      </Localized>
    </div>;
  }
}
