import React, { ReactNode, PureComponent } from "react";

import { connect, ComponentProps } from "../store/component";
import { StoreState } from "../store/types";
import Album from "./album";
import Catalog from "./catalog";
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

class PageDisplay extends PureComponent<ComponentProps<{}, typeof mapStateToProps>> {
  public render(): ReactNode {
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
