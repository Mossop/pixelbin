import { Immutable } from "immer";
import React, { PureComponent, ReactNode, Fragment } from "react";

import { Obj } from "../../../utils";
import { UserData } from "../api/types";
import Banner from "../components/Banner";
import Sidebar from "../components/Sidebar";
import { StoreState } from "../store/types";
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
  PP extends Obj = Obj,
  MSP extends MapStateToProps<PP> | Obj = Obj,
  MDP extends MapDispatchToProps<PP> | Obj = Obj,
> = ComponentProps<PP, MergedMapStateToProps<PP, typeof baseMapStateToProps, MSP>, MDP>;

export abstract class BasePage<
  PP extends Obj = Obj,
  SP extends MapStateToProps<PP> | Obj = Obj,
  DP extends MapDispatchToProps<PP> | Obj = Obj,
  S = Obj
> extends PureComponent<PageProps<PP, SP, DP>, S> {
  protected renderBannerButtons(): ReactNode {
    return null;
  }

  protected getSidebarProps(): Partial<PropsFor<typeof Sidebar>> {
    return {};
  }

  protected abstract renderContent(): ReactNode;

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

export interface AuthenticatedProps {
  user: Immutable<UserData>;
}

export abstract class AuthenticatedPage<
  PP extends AuthenticatedProps = AuthenticatedProps,
  SP extends MapStateToProps<PP> | Obj = Obj,
  DP extends MapDispatchToProps<PP> | Obj = Obj,
  S = Obj
> extends BasePage<PP, SP, DP, S> {
}
