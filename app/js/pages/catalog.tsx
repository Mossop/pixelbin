import React from "react";

import { SidebarWrapper } from "../components/pages";
import { RouteComponentProps } from "react-router";
import { connect } from "react-redux";
import { StoreState, Catalog } from "../types";
import { isLoggedIn } from "../utils/helpers";
import Banner from "../content/Banner";
import Sidebar from "../content/Sidebar";
import { Button } from "../components/Button";
import { DispatchProps, showUploadOverlay } from "../utils/actions";

interface MatchParams {
  id: string;
}

interface StateProps {
  isLoggedIn: boolean;
  catalog: Catalog | undefined;
}

function mapStateToProps(state: StoreState, props: RouteComponentProps<MatchParams>): StateProps {
  let catalog: Catalog | undefined = undefined;
  if (state.serverState.user) {
    catalog = state.serverState.user.catalogs.find((c: Catalog) => c.id == props.match.params.id);
  }

  return {
    isLoggedIn: isLoggedIn(state),
    catalog,
  };
}

const mapDispatchToProps = {
  showUploadOverlay,
};

type CatalogPageProps = RouteComponentProps<MatchParams> & StateProps & DispatchProps<typeof mapDispatchToProps>;

class CatalogPage extends React.Component<CatalogPageProps> {
  private onClick: (() => void) = (): void => {
    if (!this.props.isLoggedIn || !this.props.catalog) {
      return;
    }

    this.props.showUploadOverlay(this.props.catalog.id);
  };

  public render(): React.ReactNode {
    if (this.props.isLoggedIn && this.props.catalog) {
      return <React.Fragment>
        <Banner>
          <Button l10n="catalog-upload" onClick={this.onClick}/>
        </Banner>
        <SidebarWrapper>
          <Sidebar selected={this.props.catalog.id}/>
          {this.props.children}
        </SidebarWrapper>
      </React.Fragment>;
    } else {
      return null;
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(CatalogPage);
