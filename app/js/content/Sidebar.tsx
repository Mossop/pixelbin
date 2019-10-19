import React from "react";
import { connect } from "react-redux";

import { showCatalogCreateOverlay, DispatchProps } from "../store/actions";
import { Button } from "../components/Button";
import { StoreState } from "../store/types";
import { Catalog, Album } from "../api/types";
import { history } from "../utils/history";

const mapDispatchToProps = {
  showCatalogCreateOverlay: showCatalogCreateOverlay,
};

interface StateProps {
  catalogs: Map<string, Catalog>;
}

function mapStateToProps(state: StoreState): StateProps {
  if (state.serverState.user) {
    return { catalogs: state.serverState.user.catalogs };
  }
  return { catalogs: new Map() };
}

export interface SidebarProps {
  selected?: string;
}

class Sidebar extends React.Component<SidebarProps & DispatchProps<typeof mapDispatchToProps> & StateProps> {
  private onCatalogClick: ((catalog: Catalog) => void) = (catalog: Catalog): void => {
    history.push(`/catalog/${catalog.id}`);
  };

  private onAlbumClick: ((album: Album) => void) = (album: Album): void => {
    history.push(`/album/${album.id}`);
  };

  private renderAlbum(catalog: Catalog, album: Album, depth: number = 1): React.ReactNode {
    let innerClass = "";
    if (this.props.selected == album.id) {
      innerClass = "selected";
    }

    let children = Array.from(catalog.albums.values()).filter((a: Album): boolean => a.parent === album.id);

    return <li key={album.id} className={`depth${depth}`}>
      <Button className={innerClass} disabled={this.props.selected == album.id} iconName="folder" onClick={(): void => this.onAlbumClick(album)}>{album.name}</Button>
      <ol>
        {children.map((a: Album) => this.renderAlbum(catalog, a, depth + 1))}
      </ol>
    </li>;
  }

  private renderCatalog(catalog: Catalog): React.ReactNode {
    let innerClass = "";
    if (this.props.selected == catalog.id) {
      innerClass = "selected";
    }

    let children = Array.from(catalog.albums.values()).filter((a: Album): boolean => !a.parent);

    return <li key={catalog.id} className="depth0">
      <Button className={innerClass} disabled={this.props.selected == catalog.id} iconName="folder" onClick={(): void => this.onCatalogClick(catalog)}>{catalog.name}</Button>
      <ol>
        {children.map((a: Album) => this.renderAlbum(catalog, a))}
      </ol>
    </li>;
  }

  public render(): React.ReactNode {
    return <div id="sidebar">
      <div id="catalog-list">
        <ol>
          {Array.from(this.props.catalogs.values()).map((c: Catalog) => this.renderCatalog(c))}
        </ol>
        <p><Button l10n="sidebar-add-category" iconName="folder-plus" onClick={this.props.showCatalogCreateOverlay}/></p>
      </div>
    </div>;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Sidebar);
