import React from "react";

import { styleProps, StyleProps } from "./shared";

export enum IconStyle {
  Solid = "fas",
  Regular = "far",
}

export interface IconProps {
  iconStyle?: IconStyle;
  iconName?: string;
}

export default class Icon extends React.Component<IconProps & StyleProps> {
  public render(): React.ReactNode {
    if (!this.props.iconName) {
      return null;
    }

    let style = this.props.iconStyle || IconStyle.Solid;
    let props = styleProps(this.props, { className: [style, `fa-${this.props.iconName}`, "icon"] });
    return <span {...props}/>;
  }
}
