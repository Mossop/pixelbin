import React from "react";
import { connect } from "react-redux";

import { styleProps, StyleProps } from "./shared";
import Banner from "../content/Banner";
import Sidebar from "../content/Sidebar";
import { StoreState } from "../store/types";
import { isLoggedIn } from "../utils/helpers";

interface ChildProps {
  children: React.ReactNode;
}

export class PageContent extends React.Component<StyleProps & ChildProps> {
  public render(): React.ReactNode {
    let defaults = styleProps(this.props, { id: "content" });
    return <div {...defaults}>{this.props.children}</div>;
  }
}

export class SidebarWrapper extends React.Component<StyleProps & ChildProps> {
  public render(): React.ReactNode {
    let defaults = styleProps(this.props, { id: "sidebar-content" });
    return <div {...defaults}>{this.props.children}</div>;
  }
}

export class FullPage extends React.Component<ChildProps> {
  public render(): React.ReactNode {
    return <React.Fragment>
      <Banner/>
      {this.props.children}
    </React.Fragment>;
  }
}

interface SidebarPageProps {
  sidebarSelected?: string;
}

export class SidebarPage extends React.Component<SidebarPageProps & ChildProps> {
  public render(): React.ReactNode {
    return <React.Fragment>
      <Banner/>
      <SidebarWrapper>
        <Sidebar selected={this.props.sidebarSelected}/>
        {this.props.children}
      </SidebarWrapper>
    </React.Fragment>;
  }
}

interface StateProps {
  isLoggedIn: boolean;
}

function mapStateToProps(state: StoreState): StateProps {
  return {
    isLoggedIn: isLoggedIn(state),
  };
}

class ConnectedDefaultPage extends React.Component<StateProps & SidebarPageProps & ChildProps> {
  public render(): React.ReactNode {
    if (this.props.isLoggedIn) {
      return <SidebarPage {...this.props}>{this.props.children}</SidebarPage>;
    }
    return <FullPage>{this.props.children}</FullPage>;
  }
}

export const DefaultPage = connect(mapStateToProps)(ConnectedDefaultPage);