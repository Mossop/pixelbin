import React from "react";
import { connect } from "react-redux";

import { Catalog, Album, albumChildren } from "../api/types";
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

  private renderChildren(catalog: Catalog, album?: Album, depth: number = 1): React.ReactNode {
    let children = albumChildren(catalog, album);
    if (children.length) {
      return <ol>
        {children.map((a: Album) => this.renderAlbum(catalog, a, depth + 1))}
      </ol>;
    } else {
      return null;
    }
  }

  private renderAlbum(catalog: Catalog, album: Album, depth: number): React.ReactNode {
    return <li key={album.id} className={`depth${depth}`}>
      {this.renderItem(album.id, album.name, () => this.props.onAlbumClick(album))}
      {this.renderChildren(catalog, album, depth)}
    </li>;
  }

  private renderCatalog(catalog: Catalog): React.ReactNode {
    return <li key={catalog.id} className="depth0">
      {this.renderItem(catalog.id, catalog.name, () => this.props.onCatalogClick(catalog))}
      {this.renderChildren(catalog)}
    </li>;
  }

  public render(): React.ReactNode {
    return <ol className="catalog-tree">
      {nameSorted(this.props.catalogs).map((c: Catalog) => this.renderCatalog(c))}
    </ol>;
  }
}

export default connect(mapStateToProps)(CatalogTree);
