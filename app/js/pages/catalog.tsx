import React from "react";

import { SidebarWrapper, PageContent } from "../components/pages";
import { RouteComponentProps } from "react-router";
import { connect } from "react-redux";
import { StoreState } from "../store/types";
import { Catalog } from "../api/types";
import { isLoggedIn } from "../utils/helpers";
import Banner from "../content/Banner";
import Sidebar from "../content/Sidebar";
import { Button } from "../components/Button";
import { DispatchProps, showUploadOverlay, showCatalogEditOverlay, showAlbumCreateOverlay } from "../store/actions";
import { getCatalog } from "../store/store";
import NotFound from "./notfound";

interface MatchParams {
  id: string;
}

interface StateProps {
  isLoggedIn: boolean;
  catalog: Catalog | undefined;
}

function mapStateToProps(state: StoreState, props: RouteComponentProps<MatchParams>): StateProps {
  return {
    isLoggedIn: isLoggedIn(state),
    catalog: getCatalog(props.match.params.id),
  };
}

const mapDispatchToProps = {
  showUploadOverlay,
  showCatalogEditOverlay,
  showAlbumCreateOverlay,
};

type CatalogPageProps = RouteComponentProps<MatchParams> & StateProps & DispatchProps<typeof mapDispatchToProps>;

class CatalogPage extends React.Component<CatalogPageProps> {
  private onEdit: (() => void) = (): void => {
    if (!this.props.isLoggedIn || !this.props.catalog) {
      return;
    }

    this.props.showCatalogEditOverlay(this.props.catalog);
  };

  private onNewAlbum: (() => void) = (): void => {
    if (!this.props.isLoggedIn || !this.props.catalog) {
      return;
    }

    this.props.showAlbumCreateOverlay(this.props.catalog);
  };

  private onUpload: (() => void) = (): void => {
    if (!this.props.isLoggedIn || !this.props.catalog) {
      return;
    }

    this.props.showUploadOverlay(this.props.catalog);
  };

  public render(): React.ReactNode {
    if (this.props.isLoggedIn && this.props.catalog) {
      return <React.Fragment>
        <Banner>
          <Button l10n="catalog-edit" onClick={this.onEdit}/>
          <Button l10n="album-new-button" onClick={this.onNewAlbum}/>
          <Button l10n="catalog-upload" onClick={this.onUpload}/>
        </Banner>
        <SidebarWrapper>
          <Sidebar selected={this.props.catalog.id}/>
          <PageContent>
            {this.props.children}
          </PageContent>
        </SidebarWrapper>
      </React.Fragment>;
    } else {
      return <NotFound/>;
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(CatalogPage);
