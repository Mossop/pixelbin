import React from "react";
import { connect } from "react-redux";
import { RouteComponentProps } from "react-router";

import { Catalog } from "../api/highlevel";
import { baseConnect, BasePage, BasePageProps } from "../components/BasePage";
import { Button } from "../components/Button";
import MediaList from "../components/MediaList";
import { ComponentProps } from "../components/shared";
import { SidebarProps } from "../components/Sidebar";
import { showUploadOverlay, showCatalogEditOverlay, showAlbumCreateOverlay } from "../store/actions";
import { StoreState } from "../store/types";
import { Search } from "../utils/search";
import NotFound from "./notfound";

interface MatchParams {
  id: string;
}

type PassedProps = BasePageProps & RouteComponentProps<MatchParams>;

interface FromStateProps {
  catalog: Catalog | undefined;
}

function mapStateToProps(state: StoreState, props: RouteComponentProps<MatchParams>): FromStateProps {
  return {
    catalog: Catalog.safeFromState(state, props.match.params.id),
  };
}

const mapDispatchToProps = {
  showUploadOverlay,
  showCatalogEditOverlay,
  showAlbumCreateOverlay,
};

type CatalogPageProps = ComponentProps<PassedProps, typeof mapStateToProps, typeof mapDispatchToProps>;
class CatalogPage extends BasePage<CatalogPageProps> {
  private onEdit: (() => void) = (): void => {
    if (!this.props.user || !this.props.catalog) {
      return;
    }

    this.props.showCatalogEditOverlay(this.props.catalog);
  };

  private onNewAlbum: (() => void) = (): void => {
    if (!this.props.user || !this.props.catalog) {
      return;
    }

    this.props.showAlbumCreateOverlay(this.props.catalog);
  };

  private onUpload: (() => void) = (): void => {
    if (!this.props.user || !this.props.catalog) {
      return;
    }

    this.props.showUploadOverlay(this.props.catalog);
  };

  protected renderBannerButtons(): React.ReactNode {
    if (this.props.user && this.props.catalog) {
      return <React.Fragment>
        <Button l10n="banner-catalog-edit" onClick={this.onEdit}/>
        <Button l10n="banner-album-new" onClick={this.onNewAlbum}/>
        <Button l10n="banner-upload" onClick={this.onUpload}/>
      </React.Fragment>;
    } else {
      return null;
    }
  }

  protected getSidebarProps(): Partial<SidebarProps> {
    return {
      selectedItem: this.props.catalog,
    };
  }

  protected renderContent(): React.ReactNode {
    if (this.props.user && this.props.catalog) {
      let search: Search = {
        catalog: this.props.catalog.id,
      };
      return <MediaList search={search}/>;
    } else {
      return <NotFound/>;
    }
  }
}

export default baseConnect(connect(mapStateToProps, mapDispatchToProps)(CatalogPage));
