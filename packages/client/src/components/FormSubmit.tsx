import React, { PureComponent, ReactNode } from "react";

import { L10nProps } from "../l10n";
import { Localized } from "../l10n/Localized";
import { styleProps, FieldProps } from "../utils/props";

export type FormSubmitProps = FieldProps & L10nProps;

export default class FormSubmit extends PureComponent<FormSubmitProps> {
  public render(): ReactNode {
    return <div {...styleProps(this.props, { className: ["formSubmit"] })}>
      <Localized l10n={this.props.l10n}>
        <button type="submit" disabled={this.props.disabled}/>
      </Localized>
    </div>;
  }
}
