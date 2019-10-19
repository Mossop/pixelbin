import React from "react";
import { connect } from "react-redux";

import { showCatalogCreateOverlay, DispatchProps } from "../store/actions";
import { Button } from "../components/Button";
import { StoreState } from "../store/types";
import { Catalog, Album } from "../api/types";
import { history } from "../utils/history";
import { Mapped } from "../utils/decoders";
import { nameSorted } from "../utils/sort";

const mapDispatchToProps = {
  showCatalogCreateOverlay: showCatalogCreateOverlay,
};

interface StateProps {
  catalogs: Mapped<Catalog>;
}

function mapStateToProps(state: StoreState): StateProps {
  if (state.serverState.user) {
    return { catalogs: state.serverState.user.catalogs };
  }
  return { catalogs: {} };
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

    let inner: React.ReactNode = null;
    let children = nameSorted(Object.values(catalog.albums).filter((a: Album): boolean => a.parent === album.id));
    if (children.length) {
      inner = <ol>
        {children.map((a: Album) => this.renderAlbum(catalog, a, depth + 1))}
      </ol>;
    }

    return <li key={album.id} className={`depth${depth}`}>
      <Button className={innerClass} disabled={this.props.selected == album.id} iconName="folder" onClick={(): void => this.onAlbumClick(album)}>{album.name}</Button>
      {inner}
    </li>;
  }

  private renderCatalog(catalog: Catalog): React.ReactNode {
    let innerClass = "";
    if (this.props.selected == catalog.id) {
      innerClass = "selected";
    }

    let inner: React.ReactNode = null;
    let children = nameSorted(Object.values(catalog.albums).filter((a: Album): boolean => !a.parent));
    if (children.length) {
      inner = <ol>
        {children.map((a: Album) => this.renderAlbum(catalog, a))}
      </ol>;
    }

    return <li key={catalog.id} className="depth0">
      <Button className={innerClass} disabled={this.props.selected == catalog.id} iconName="folder" onClick={(): void => this.onCatalogClick(catalog)}>{catalog.name}</Button>
      {inner}
    </li>;
  }

  public render(): React.ReactNode {
    return <div id="sidebar">
      <div id="catalog-list">
        <ol>
          {nameSorted(this.props.catalogs).map((c: Catalog) => this.renderCatalog(c))}
        </ol>
        <p><Button l10n="sidebar-add-category" iconName="folder-plus" onClick={this.props.showCatalogCreateOverlay}/></p>
      </div>
    </div>;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Sidebar);
