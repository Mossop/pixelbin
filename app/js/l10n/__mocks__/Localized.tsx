import React, { ReactNode, PureComponent } from "react";

import { L10nProps } from "..";

export class Localized extends PureComponent<L10nProps> {
  public render(): ReactNode {
    let id = typeof this.props.l10n == "string" ? this.props.l10n : this.props.l10n.id;
    return <div className="localized" id={id}>
      {this.props.children}
    </div>;
  }
}
