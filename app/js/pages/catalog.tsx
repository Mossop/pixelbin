import React, { ReactNode, Fragment } from "react";

import { Catalog, Reference } from "../api/highlevel";
import Button from "../components/Button";
import MediaList from "../components/MediaList";
import Sidebar from "../components/Sidebar";
import actions from "../store/actions";
import { StoreState } from "../store/types";
import { PropsFor } from "../utils/component";
import { Search } from "../utils/search";
import { baseConnect, BasePage } from "./BasePage";
import NotFound from "./notfound";

interface PassedProps {
  catalog: Reference<Catalog>;
}

interface FromStateProps {
  catalog: Catalog | undefined;
}

function mapStateToProps(state: StoreState, props: PassedProps): FromStateProps {
  return {
    catalog: props.catalog.deref(state.serverState),
  };
}

const mapDispatchToProps = {
  showUploadOverlay: actions.showUploadOverlay,
  showCatalogEditOverlay: actions.showCatalogEditOverlay,
  showAlbumCreateOverlay: actions.showAlbumCreateOverlay,
};

class CatalogPage extends BasePage<PassedProps, typeof mapStateToProps, typeof mapDispatchToProps> {
  private onEdit: (() => void) = (): void => {
    if (!this.props.user || !this.props.catalog) {
      return;
    }

    this.props.showCatalogEditOverlay(this.props.catalog.ref());
  };

  private onNewAlbum: (() => void) = (): void => {
    if (!this.props.user || !this.props.catalog) {
      return;
    }

    this.props.showAlbumCreateOverlay(this.props.catalog.ref());
  };

  private onUpload: (() => void) = (): void => {
    if (!this.props.user || !this.props.catalog) {
      return;
    }

    this.props.showUploadOverlay();
  };

  protected renderBannerButtons(): ReactNode {
    if (this.props.user && this.props.catalog) {
      return <Fragment>
        <Button l10n="banner-catalog-edit" onClick={this.onEdit}/>
        <Button l10n="banner-album-new" onClick={this.onNewAlbum}/>
        <Button l10n="banner-upload" onClick={this.onUpload}/>
      </Fragment>;
    } else {
      return null;
    }
  }

  protected getSidebarProps(): Partial<PropsFor<typeof Sidebar>> {
    return {
      selectedItem: this.props.catalog,
    };
  }

  protected renderContent(): ReactNode {
    if (this.props.user && this.props.catalog) {
      let search: Search = {
        catalog: this.props.catalog.ref(),
      };
      return <MediaList search={search}/>;
    } else {
      return <NotFound/>;
    }
  }
}

export default baseConnect<PassedProps>()(CatalogPage, mapStateToProps, mapDispatchToProps);
