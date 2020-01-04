import React from "react";
import { connect } from "react-redux";

import { showCatalogCreateOverlay, DispatchProps } from "../store/actions";
import { StoreState } from "../store/types";
import { Catalog, Album } from "../api/types";
import { history } from "../utils/history";
import { MapOf } from "../utils/maps";
import { CatalogTreeSidebar } from "./CatalogTree";
import { Button } from "./Button";

const mapDispatchToProps = {
  showCatalogCreateOverlay: showCatalogCreateOverlay,
};

interface StateProps {
  catalogs: MapOf<Catalog>;
}

function mapStateToProps(state: StoreState): StateProps {
  if (state.serverState.user) {
    return { catalogs: state.serverState.user.catalogs };
  }
  return { catalogs: new Map() };
}

export interface SidebarProps {
  album?: Album;
}

class Sidebar extends React.Component<SidebarProps & DispatchProps<typeof mapDispatchToProps> & StateProps> {
  private onCatalogClick: ((catalog: Catalog) => void) = (catalog: Catalog): void => {
    history.push(`/catalog/${catalog.id}`);
  };

  private onAlbumClick: ((album: Album) => void) = (album: Album): void => {
    history.push(`/album/${album.id}`);
  };

  public render(): React.ReactNode {
    return <div id="sidebar">
      <div id="catalog-tree">
        <CatalogTreeSidebar album={this.props.album} onCatalogClick={this.onCatalogClick} onAlbumClick={this.onAlbumClick}/>
        <Button id="new-catalog" l10n="sidebar-add-catalog" iconName="folder-plus" onClick={this.props.showCatalogCreateOverlay}/>
      </div>
    </div>;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Sidebar);
