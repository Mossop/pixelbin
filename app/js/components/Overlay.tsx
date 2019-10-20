
import React from "react";
import { connect } from "react-redux";
import { Localized } from "@fluent/react";

import { Button } from "./Button";
import { DispatchProps, closeOverlay } from "../store/actions";

interface Props {
  title?: string | React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}

const mapDispatchToOverlayProps = {
  closeOverlay,
};

export type OverlayProps = Props & DispatchProps<typeof mapDispatchToOverlayProps>;
export type OverlayState = {};

class Overlay extends React.Component<OverlayProps> {
  public render(): React.ReactNode {
    let sidebar = this.props.sidebar;
    let title: React.ReactNode;
    if (this.props.title && typeof this.props.title == "string") {
      title = <Localized id={this.props.title}><h1 className="title"/></Localized>;
    } else {
      title = this.props.title;
    }

    if (sidebar) {
      return <div id="overlay-inner">
        <div id="overlay-header">
          {title}
          <Button id="overlay-close" iconName="times" tooltipL10n="overlay-close" onClick={this.props.closeOverlay}/>
        </div>
        <div id="overlay-sidebar-wrapper">
          <div id="overlay-sidebar">{sidebar}</div>
          <div id="overlay-content">{this.props.children}</div>
        </div>
      </div>;
    } else {
      return <div id="overlay-inner">
        <div id="overlay-header">
          {title}
          <Button id="overlay-close" iconName="times" tooltipL10n="overlay-close" onClick={this.props.closeOverlay}/>
        </div>
        <div id="overlay-content">{this.props.children}</div>
      </div>;
    }
  }
}

export default connect(undefined, mapDispatchToOverlayProps)(Overlay);
