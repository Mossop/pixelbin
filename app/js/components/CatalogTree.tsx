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
  private renderItem(item: Album | Catalog, onClick: () => void): React.ReactNode {
    if (this.props.selected === item.id) {
      return <p className="item selected"><Icon iconName="folder"/>{item.name}</p>;
    } else {
      return <Button className="item" iconName="folder" onClick={onClick}>{item.name}</Button>;
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
      {this.renderItem(album, () => this.props.onAlbumClick(album))}
      {this.renderChildren(catalog, album, depth)}
    </li>;
  }

  private renderCatalog(catalog: Catalog): React.ReactNode {
    return <li key={catalog.id} className="depth0">
      {this.renderItem(catalog, () => this.props.onCatalogClick(catalog))}
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
