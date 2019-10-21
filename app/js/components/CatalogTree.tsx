import React from "react";
import { connect } from "react-redux";

import { Catalog, Album, albumChildren } from "../api/types";
import { catalogNameSorted } from "../utils/sort";
import { Button } from "./Button";
import { StoreState } from "../store/types";
import Icon from "./Icon";
import { UIContext, Context, getTextState } from "../utils/UIState";
import { Mapped } from "../utils/maps";

interface StateProps {
  catalogs: Mapped<Catalog>;
}

function mapStateToProps(state: StoreState): StateProps {
  if (state.serverState.user) {
    return { catalogs: state.serverState.user.catalogs };
  }
  return { catalogs: {} };
}

abstract class CatalogTree<P extends StateProps> extends React.Component<P> {
  protected abstract onAlbumClick(album: Album): void;
  protected abstract onCatalogClick(catalog: Catalog): void;

  protected renderItem(item: Album, onClick: () => void): React.ReactNode {
    return <Button className="item" iconName="folder" onClick={onClick}>{item.name}</Button>;
  }

  private renderChildren(catalog: Catalog, album: Album, depth: number = 1): React.ReactNode {
    let children = albumChildren(catalog, album);
    if (children.length) {
      return <ol>
        {children.map((a: Album) => this.renderAlbum(catalog, a, depth))}
      </ol>;
    } else {
      return null;
    }
  }

  private renderAlbum(catalog: Catalog, album: Album, depth: number): React.ReactNode {
    return <li key={album.id} className={`depth${depth}`}>
      {this.renderItem(album, () => this.onAlbumClick(album))}
      {this.renderChildren(catalog, album, depth + 1)}
    </li>;
  }

  private renderCatalog(catalog: Catalog): React.ReactNode {
    return <li key={catalog.id} className="depth0">
      {this.renderItem(catalog.root, () => this.onCatalogClick(catalog))}
      {this.renderChildren(catalog, catalog.root)}
    </li>;
  }

  public render(): React.ReactNode {
    return <ol className="catalog-tree">
      {catalogNameSorted(this.props.catalogs).map((c: Catalog) => this.renderCatalog(c))}
    </ol>;
  }
}

interface SelectorProps {
  uiPath: string;
}

class CatalogTreeSelectorComponent extends CatalogTree<SelectorProps & StateProps> {
  public static contextType: React.Context<UIContext> = Context;
  public context!: React.ContextType<typeof Context>;

  private getSelected(): string {
    return getTextState(this.context.getState(this.props.uiPath));
  }

  protected onAlbumClick(album: Album): void {
    this.context.setState(this.props.uiPath, { text: album.id });
  }

  protected onCatalogClick(catalog: Catalog): void {
    this.context.setState(this.props.uiPath, { text: catalog.id });
  }

  protected renderItem(item: Album, onClick: () => void): React.ReactNode {
    if (this.getSelected() === item.id) {
      return <p className="item selected"><Icon iconName="folder-open"/>{item.name}</p>;
    } else {
      return <Button className="item" iconName="folder" onClick={onClick}>{item.name}</Button>;
    }
  }
}

export const CatalogTreeSelector = connect(mapStateToProps)(CatalogTreeSelectorComponent);

interface SidebarProps {
  onCatalogClick: (catalog: Catalog) => void;
  onAlbumClick: (album: Album) => void;
  selected?: string;
}

class CatalogTreeSidebarComponent extends CatalogTree<SidebarProps & StateProps> {
  protected onAlbumClick(album: Album): void {
    this.props.onAlbumClick(album);
  }

  protected onCatalogClick(catalog: Catalog): void {
    this.props.onCatalogClick(catalog);
  }

  protected renderItem(item: Album, onClick: () => void): React.ReactNode {
    if (this.props.selected === item.id) {
      return <p className="item selected"><Icon iconName="folder-open"/>{item.name}</p>;
    } else {
      return <Button className="item" iconName="folder" onClick={onClick}>{item.name}</Button>;
    }
  }
}

export const CatalogTreeSidebar = connect(mapStateToProps)(CatalogTreeSidebarComponent);
