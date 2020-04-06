import { Localized } from "@fluent/react";
import React, { ReactNode, PureComponent } from "react";

import actions from "../store/actions";
import { connect, ComponentProps } from "../utils/component";
import { AppError } from "../utils/exception";
import Button from "./Button";

interface PassedProps {
  title?: string | ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
  error?: AppError;
}

const mapDispatchToProps = {
  closeOverlay: actions.closeOverlay,
};

class Overlay extends PureComponent<ComponentProps<PassedProps, {}, typeof mapDispatchToProps>> {
  public renderError(): ReactNode {
    if (this.props.error) {
      return <Localized {...this.props.error.l10nAttributes()}>
        <h1 id="overlay-error"/>
      </Localized>;
    } else {
      return null;
    }
  }

  public renderContent(): ReactNode {
    return <div id="overlay-main">
      {this.renderError()}
      <div id="overlay-content">{this.props.children}</div>
    </div>;
  }

  public renderSidebar(): ReactNode {
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

  public render(): ReactNode {
    let title: ReactNode;
    if (this.props.title && typeof this.props.title == "string") {
      title = <Localized id={this.props.title}><h1 className="title"/></Localized>;
    } else {
      title = this.props.title;
    }

    let className = this.props.error ? "error" : "";

    return <div id="overlay-inner" className={className}>
      <div id="overlay-header">
        {title}
        <Button
          id="overlay-close"
          iconName="times"
          tooltipL10n="overlay-close"
          onClick={this.props.closeOverlay}
        />
      </div>
      {this.renderSidebar()}
    </div>;
  }
}

export default connect<PassedProps>()(Overlay, undefined, mapDispatchToProps);
