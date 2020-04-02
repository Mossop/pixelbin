import React from "react";

import { Catalog, Reference } from "../api/highlevel";
import { baseConnect, BasePage } from "../components/BasePage";
import Button from "../components/Button";
import MediaList from "../components/MediaList";
import Sidebar from "../components/Sidebar";
import { showUploadOverlay, showCatalogEditOverlay, showAlbumCreateOverlay } from "../store/actions";
import { PropsFor } from "../store/component";
import { StoreState } from "../store/types";
import { Search } from "../utils/search";
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
  showUploadOverlay,
  showCatalogEditOverlay,
  showAlbumCreateOverlay,
};

class CatalogPage extends BasePage<PassedProps, typeof mapStateToProps, typeof mapDispatchToProps> {
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

  protected getSidebarProps(): Partial<PropsFor<typeof Sidebar>> {
    return {
      selectedItem: this.props.catalog,
    };
  }

  protected renderContent(): React.ReactNode {
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
