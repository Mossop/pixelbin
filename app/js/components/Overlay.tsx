import React from "react";
import { connect } from "react-redux";
import { Localized } from "@fluent/react";

import { Button } from "./Button";
import { DispatchProps, closeOverlay } from "../store/actions";
import { APIError, errorL10n } from "../api/types";

interface Props {
  title?: string | React.ReactNode;
  sidebar?: React.ReactNode;
  error?: APIError;
  children: React.ReactNode;
}

const mapDispatchToOverlayProps = {
  closeOverlay,
};

export type OverlayProps = Props & DispatchProps<typeof mapDispatchToOverlayProps>;
export type OverlayState = {};

class Overlay extends React.Component<OverlayProps> {
  public renderError(): React.ReactNode {
    if (this.props.error) {
      return <Localized {...errorL10n(this.props.error)}>
        <h1 id="overlay-error"/>
      </Localized>;
    } else {
      return null;
    }
  }

  public renderContent(): React.ReactNode {
    return <div id="overlay-main">
      {this.renderError()}
      <div id="overlay-content">{this.props.children}</div>
    </div>;
  }

  public renderSidebar(): React.ReactNode {
    if (this.props.sidebar) {
      return <div id="overlay-sidebar-wrapper">
        <div id="overlay-sidebar">
          <div id="overlay-sidebar-inner">{this.props.sidebar}</div>
        </div>
        {this.renderContent()}
      </div>;
    } else {
      return this.renderContent();
    }
  }

  public render(): React.ReactNode {
    let title: React.ReactNode;
    if (this.props.title && typeof this.props.title == "string") {
      title = <Localized id={this.props.title}><h1 className="title"/></Localized>;
    } else {
      title = this.props.title;
    }

    let className = this.props.error ? "error" : "";

    return <div id="overlay-inner" className={className}>
      <div id="overlay-header">
        {title}
        <Button id="overlay-close" iconName="times" tooltipL10n="overlay-close" onClick={this.props.closeOverlay}/>
      </div>
      {this.renderSidebar()}
    </div>;
  }
}

export default connect(undefined, mapDispatchToOverlayProps)(Overlay);
