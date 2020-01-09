import React from "react";
import { connect } from "react-redux";

import { UserData } from "../api/types";
import { StoreState } from "../store/types";
import Banner from "./Banner";
import Sidebar, { PassedProps as SidebarProps } from "./Sidebar";
import { Immutable } from "../utils/immer";
import { ComponentProps } from "./shared";

export interface FromStateProps {
  user?: Immutable<UserData>;
}

function mapStateToProps(state: StoreState): FromStateProps {
  return {
    user: state.serverState.user,
  };
}

export type BasePageProps = ComponentProps<{}, typeof mapStateToProps>;
export type BasePageState = {};
export class BasePage<P, S extends BasePageState = BasePageState> extends React.Component<P & BasePageProps, S> {
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
