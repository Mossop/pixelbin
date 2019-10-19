import React from "react";
import { connect } from "react-redux";

import { Catalog, Album } from "../api/types";
import { nameSorted } from "../utils/sort";
import { Button } from "./Button";
import { Mapped } from "../utils/decoders";
import { StoreState } from "../store/types";
import Icon from "./Icon";

interface Props {
  onCatalogClick: (catalog: Catalog) => void;
  onAlbumClick: (catalog: Album) => void;
  selected?: string;
}

interface StateProps {
  catalogs: Mapped<Catalog>;
}

function mapStateToProps(state: StoreState): StateProps {
  if (state.serverState.user) {
    return { catalogs: state.serverState.user.catalogs };
  }
  return { catalogs: {} };
}

type CatalogTreeProps = Props & StateProps;

class CatalogTree extends React.Component<CatalogTreeProps> {
  private renderItem(id: string, name: string, onClick: () => void): React.ReactNode {
    if (this.props.selected === id) {
      return <p className="item selected"><Icon iconName="folder"/>{name}</p>;
    } else {
      return <Button className="item" iconName="folder" onClick={onClick}>{name}</Button>;
    }
  }

  private renderAlbum(catalog: Catalog, album: Album, depth: number = 1): React.ReactNode {
    let inner: React.ReactNode = null;
    let children = nameSorted(Object.values(catalog.albums).filter((a: Album): boolean => a.parent === album.id));
    if (children.length) {
      inner = <ol>
        {children.map((a: Album) => this.renderAlbum(catalog, a, depth + 1))}
      </ol>;
    }

    return <li key={album.id} className={`depth${depth}`}>
      {this.renderItem(album.id, album.name, () => this.props.onAlbumClick(album))}
      {inner}
    </li>;
  }

  private renderCatalog(catalog: Catalog): React.ReactNode {
    let inner: React.ReactNode = null;
    let children = nameSorted(Object.values(catalog.albums).filter((a: Album): boolean => !a.parent));
    if (children.length) {
      inner = <ol>
        {children.map((a: Album) => this.renderAlbum(catalog, a))}
      </ol>;
    }

    return <li key={catalog.id} className="depth0">
      {this.renderItem(catalog.id, catalog.name, () => this.props.onCatalogClick(catalog))}
      {inner}
    </li>;
  }

  public render(): React.ReactNode {
    return <ol className="catalog-tree">
      {nameSorted(this.props.catalogs).map((c: Catalog) => this.renderCatalog(c))}
    </ol>;
  }
}

export default connect(mapStateToProps)(CatalogTree);
