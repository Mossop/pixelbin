import React from "react";

import { Localized } from "@fluent/react";

import { defaultProps, FieldProps } from "./shared";
import { L10nProps } from "../l10n";

export type FormSubmitProps = FieldProps & L10nProps;

export default class FormSubmit extends React.Component<FormSubmitProps> {
  public render(): React.ReactNode {
    return <p {...defaultProps(this.props, { className: "spanEnd" })}>
      <Localized id={this.props.l10n}>
        <button disabled={this.props.disabled}/>
      </Localized>
    </p>;
  }
}
