import React from "react";

import { styleProps, StyleProps } from "./shared";

export enum IconType {
  FontAwesome = "fontawesone",
  Material = "material",
}

export interface IconProps {
  iconType?: IconType;
  iconName?: string;
}

export function beforeIconClasses(name: string, type: IconType = IconType.FontAwesome): string[] {
  let classes = ["icon-before"];
  if (type === IconType.FontAwesome) {
    classes.push("font-awesome", `fa-${name}`);
  } else {
    // Unknown
  }

  return classes;
}

export default class Icon extends React.Component<IconProps & StyleProps> {
  public render(): React.ReactNode {
    if (!this.props.iconName) {
      return null;
    }

    if (this.props.iconType === IconType.Material) {
      let props = styleProps(this.props, { className: ["material-icons", "icon"] });
      return <span {...props}>${this.props.iconName}</span>;
    } else {
      let props = styleProps(this.props, { className: ["fas", `fa-${this.props.iconName}`, "icon"] });
      return <span {...props}/>;
    }
  }
}
