import React from "react";

import { styleProps, StyleProps } from "./shared";

export class Page extends React.Component<StyleProps> {
  public render(): React.ReactNode {
    let defaults = styleProps(this.props, { id: "content" });
    return <div {...defaults}>{this.props.children}</div>;
  }
}

export class SidebarPage extends React.Component<StyleProps> {
  public render(): React.ReactNode {
    let defaults = styleProps(this.props, { id: "sidebar-content" });
    return <div {...defaults}>{this.props.children}</div>;
  }
}
