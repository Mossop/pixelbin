import { Immutable } from "immer";
import React from "react";

import { UserData } from "../api/types";
import { ComponentProps, MapStateToProps, MapDispatchToProps, PropsFor, MergedMapStateToProps, mergedConnect } from "../store/component";
import { StoreState } from "../store/types";
import Banner from "./Banner";
import Sidebar from "./Sidebar";

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
  SP extends MapStateToProps<PP> | {} = {},
  DP extends MapDispatchToProps<PP> | {} = {},
> = ComponentProps<PP, MergedMapStateToProps<PP, SP, typeof baseMapStateToProps>, DP>;

export class BasePage<
  PP extends {} = {},
  SP extends MapStateToProps<PP> | {} = {},
  DP extends MapDispatchToProps<PP> | {} = {},
  S = {}
> extends React.Component<PageProps<PP, SP, DP>, S> {
  protected renderBannerButtons(): React.ReactNode {
    return null;
  }

  protected getSidebarProps(): Partial<PropsFor<typeof Sidebar>> {
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

export const baseConnect = mergedConnect(baseMapStateToProps);
