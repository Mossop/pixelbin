import React, { ReactNode, PureComponent, ErrorInfo } from "react";

import { Obj } from "../../../utils";
import { UserState } from "../api/types";
import { StoreState } from "../store/types";
import { connect, ComponentProps } from "../utils/component";
import Album from "./album";
import Catalog from "./catalog";
import ErrorPage from "./error";
import Index from "./indexpage";
import NotFound from "./notfound";
import { PageType, PageState } from "./types";
import User from "./user";

interface FromStateProps {
  page: PageState;
  user: UserState | null;
}

function mapStateToProps(state: StoreState): FromStateProps {
  return {
    page: state.ui.page,
    user: state.serverState.user,
  };
}

interface PageDisplayState {
  error?: string;
}

type PageDisplayProps = ComponentProps<Obj, typeof mapStateToProps>;
class PageDisplay extends PureComponent<PageDisplayProps, PageDisplayState> {
  public constructor(props: PageDisplayProps) {
    super(props);
    this.state = {};
  }

  public static getDerivedStateFromError(error: Error): Partial<PageDisplayState> {
    return { error: String(error) };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(error, errorInfo.componentStack);
  }

  public render(): ReactNode {
    if (this.state.error) {
      return <ErrorPage error={this.state.error}/>;
    }

    if (this.props.user) {
      switch (this.props.page.type) {
        case PageType.User: {
          return <User user={this.props.user}/>;
        }
        case PageType.Catalog: {
          return <Catalog user={this.props.user} catalog={this.props.page.catalog}/>;
        }
        case PageType.Album: {
          return <Album user={this.props.user} album={this.props.page.album}/>;
        }
      }
    }

    switch (this.props.page.type) {
      case PageType.Index: {
        return <Index/>;
      }
      case PageType.NotFound: {
        return <NotFound/>;
      }
    }

    return <ErrorPage error="Internal error."/>;
  }
}

export default connect()(PageDisplay, mapStateToProps);
