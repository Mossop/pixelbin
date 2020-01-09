import React from "react";
import { connect } from "react-redux";

import { showCatalogCreateOverlay } from "../store/actions";
import { StoreState } from "../store/types";
import { CatalogData } from "../api/types";
import { history } from "../utils/history";
import { CatalogTreeSidebar } from "./CatalogTree";
import { Button } from "./Button";
import { Immutable } from "../utils/immer";
import { Catalog, Album } from "../api/highlevel";
import { ComponentProps } from "./shared";

export interface PassedProps {
  selectedAlbum?: Album;
}

interface FromStateProps {
  catalogs: Catalog[];
}

function mapStateToProps(state: StoreState): FromStateProps {
  return {
    catalogs: Array.from(state.serverState.user?.catalogs.values() || [])
      .map((catalogState: Immutable<CatalogData>) => Catalog.fromState(state, catalogState)),
  };
}

const mapDispatchToProps = {
  showCatalogCreateOverlay: showCatalogCreateOverlay,
};

type SidebarProps = ComponentProps<PassedProps, typeof mapStateToProps, typeof mapDispatchToProps>;
class Sidebar extends React.Component<SidebarProps> {
  private onCatalogClick: ((catalog: Catalog) => void) = (catalog: Catalog): void => {
    history.push(`/catalog/${catalog.id}`);
  };

  private onAlbumClick: ((album: Album) => void) = (album: Album): void => {
    history.push(`/album/${album.id}`);
  };

  public render(): React.ReactNode {
    return <div id="sidebar">
      <div id="catalog-tree">
        <CatalogTreeSidebar selectedAlbum={this.props.selectedAlbum} onCatalogClick={this.onCatalogClick} onAlbumClick={this.onAlbumClick}/>
        <Button id="new-catalog" l10n="sidebar-add-catalog" iconName="folder-plus" onClick={this.props.showCatalogCreateOverlay}/>
      </div>
    </div>;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Sidebar);
