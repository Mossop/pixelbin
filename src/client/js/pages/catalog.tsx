import React, { ReactNode, Fragment } from "react";

import { Catalog, Reference } from "../api/highlevel";
import { UserState } from "../api/types";
import Button from "../components/Button";
import MediaList from "../components/MediaList";
import Sidebar from "../components/Sidebar";
import actions from "../store/actions";
import { StoreState } from "../store/types";
import { PropsFor } from "../utils/component";
import { Search } from "../utils/search";
import { baseConnect, AuthenticatedPage } from "./BasePage";

interface PassedProps {
  catalog: Reference<Catalog>;
  user: UserState;
}

interface FromStateProps {
  catalog: Catalog;
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

class CatalogPage extends AuthenticatedPage<
  PassedProps,
  typeof mapStateToProps,
  typeof mapDispatchToProps
> {
  private onEdit: (() => void) = (): void => {
    this.props.showCatalogEditOverlay(this.props.catalog.ref());
  };

  private onNewAlbum: (() => void) = (): void => {
    this.props.showAlbumCreateOverlay(this.props.catalog.ref());
  };

  private onUpload: (() => void) = (): void => {
    this.props.showUploadOverlay();
  };

  protected renderBannerButtons(): ReactNode {
    return <Fragment>
      <Button l10n="banner-catalog-edit" onClick={this.onEdit}/>
      <Button l10n="banner-album-new" onClick={this.onNewAlbum}/>
      <Button l10n="banner-upload" onClick={this.onUpload}/>
    </Fragment>;
  }

  protected getSidebarProps(): Partial<PropsFor<typeof Sidebar>> {
    return {
      selectedItem: this.props.catalog,
    };
  }

  protected renderContent(): ReactNode {
    let search: Search = {
      catalog: this.props.catalog.ref(),
    };
    return <MediaList search={search}/>;
  }
}

export default baseConnect<PassedProps>()(CatalogPage, mapStateToProps, mapDispatchToProps);
