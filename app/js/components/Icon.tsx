import React from "react";

import { styleProps, StyleProps } from "./shared";

export interface IconProps {
  iconType?: "fontawesome" | "material";
  iconName?: string;
}

export default class Icon extends React.Component<IconProps & StyleProps> {
  public render(): React.ReactNode {
    if (!this.props.iconName) {
      return null;
    }

    if (this.props.iconType === "material") {
      let props = styleProps(this.props, { className: ["material-icons", "icon"] });
      return <span {...props}>${this.props.iconName}</span>;
    } else {
      let props = styleProps(this.props, { className: ["fas", `fa-${this.props.iconName}`, "icon"] });
      return <span {...props}/>;
    }
  }
}
