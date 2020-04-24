import { Immutable } from "immer";
import React, { PureComponent, ReactNode, Fragment } from "react";

import { UserData } from "../api";
import Banner from "../components/Banner";
import Sidebar from "../components/Sidebar";
import { StoreState } from "../store";
import {
  ComponentProps,
  MapStateToProps,
  MapDispatchToProps,
  PropsFor,
  mergedConnect,
  MergedMapStateToProps,
} from "../utils/component";

export interface FromStateProps {
  user: Immutable<UserData> | null;
}

function baseMapStateToProps(state: StoreState): FromStateProps {
  return {
    user: state.serverState.user,
  };
}

export type PageProps<
  PP extends {} = {},
  MSP extends MapStateToProps<PP> | {} = {},
  MDP extends MapDispatchToProps<PP> | {} = {},
> = ComponentProps<PP, MergedMapStateToProps<PP, typeof baseMapStateToProps, MSP>, MDP>;

export class BasePage<
  PP extends {} = {},
  SP extends MapStateToProps<PP> | {} = {},
  DP extends MapDispatchToProps<PP> | {} = {},
  S = {}
> extends PureComponent<PageProps<PP, SP, DP>, S> {
  protected renderBannerButtons(): ReactNode {
    return null;
  }

  protected getSidebarProps(): Partial<PropsFor<typeof Sidebar>> {
    return {};
  }

  protected renderContent(): ReactNode {
    return null;
  }

  public render(): ReactNode {
    if (this.props.user) {
      return <Fragment>
        <Banner>{this.renderBannerButtons()}</Banner>
        <div id="sidebar-content">
          <Sidebar {...this.getSidebarProps()}/>
          <div id="content">{this.renderContent()}</div>
        </div>
      </Fragment>;
    } else {
      return <Fragment>
        <Banner>{this.renderBannerButtons()}</Banner>
        <div id="content">{this.renderContent()}</div>
      </Fragment>;
    }
  }
}

export const baseConnect = mergedConnect(baseMapStateToProps);
