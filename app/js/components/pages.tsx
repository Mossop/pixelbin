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
      <PageContent>{this.props.children}</PageContent>
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
        <PageContent>{this.props.children}</PageContent>
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

class Standard extends React.Component<StateProps & SidebarPageProps & ChildProps> {
  public render(): React.ReactNode {
    if (this.props.isLoggedIn) {
      return <SidebarWrapper>
        <Sidebar selected={this.props.sidebarSelected}/>
        <PageContent>{this.props.children}</PageContent>
      </SidebarWrapper>;
    } else {
      return <PageContent>{this.props.children}</PageContent>;
    }
  }
}

export const StandardContent = connect(mapStateToProps)(Standard);

export class DefaultPage extends React.Component<ChildProps> {
  public render(): React.ReactNode {
    return <React.Fragment>
      <Banner/>
      <StandardContent>
        {this.props.children}
      </StandardContent>
    </React.Fragment>;
  }
}
