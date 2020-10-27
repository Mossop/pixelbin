import { Localized as FluentLocalized } from "@fluent/react";
import type { ReactNode } from "react";
import React, { PureComponent } from "react";

import type { L10nProps } from ".";

export class Localized extends PureComponent<L10nProps> {
  public render(): ReactNode {
    if (typeof this.props.l10n == "string") {
      return <FluentLocalized id={this.props.l10n}>
        {this.props.children}
      </FluentLocalized>;
    }

    return <FluentLocalized {...this.props.l10n}>
      {this.props.children}
    </FluentLocalized>;
  }
}
