import React, { ReactNode, PureComponent, ErrorInfo } from "react";

import { StoreState } from "../store/types";
import { connect, ComponentProps } from "../utils/component";
import Album from "./album";
import Catalog from "./catalog";
import ErrorPage from "./error";
import Index from "./indexpage";
import NotFound from "./notfound";
import { PageType, PageState } from "./types";
import User from "./user";

export * from "./types";

interface FromStateProps {
  page: PageState;
}

function mapStateToProps(state: StoreState): FromStateProps {
  return {
    page: state.ui.page,
  };
}

interface PageDisplayState {
  error?: string;
}

type PageDisplayProps = ComponentProps<{}, typeof mapStateToProps>;
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

    switch (this.props.page.type) {
      case PageType.Index: {
        return <Index/>;
      }
      case PageType.User: {
        return <User/>;
      }
      case PageType.NotFound: {
        return <NotFound/>;
      }
      case PageType.Catalog: {
        return <Catalog catalog={this.props.page.catalog}/>;
      }
      case PageType.Album: {
        return <Album album={this.props.page.album}/>;
      }
    }
  }
}

export default connect()(PageDisplay, mapStateToProps);
