import React from "react";
import { connect } from "react-redux";

import Banner from "../components/Banner";
import { User } from "../api/types";
import { StoreState } from "../store/types";
import Sidebar, { SidebarProps } from "../components/Sidebar";

interface StateProps {
  user?: User;
}

function mapStateToProps(state: StoreState): StateProps {
  return {
    user: state.serverState.user,
  };
}

export type BasePageProps = StateProps;
export type BasePageState = {};

export class BasePage<P extends BasePageProps, S extends BasePageState> extends React.Component<P, S> {
  protected renderBannerButtons(): React.ReactNode {
    return null;
  }

  protected getSidebarProps(): Partial<SidebarProps> {
    return {};
  }

  protected renderContent(): React.ReactNode {
    return null;
  }

  public render(): React.ReactNode {
    if (this.props.user) {
      return <React.Fragment>
        <Banner>{this.renderBannerButtons()}</Banner>
        <div id="sidebar-content">
          <Sidebar {...this.getSidebarProps()}/>
          <div id="content">{this.renderContent()}</div>
        </div>
      </React.Fragment>;
    } else {
      return <React.Fragment>
        <Banner>{this.renderBannerButtons()}</Banner>
        <div id="content">{this.renderContent()}</div>
      </React.Fragment>;
    }
  }
}

export const baseConnect = connect(mapStateToProps);
