import React from "react";
import { connect } from "react-redux";

import { Catalog, Album } from "../api/types";
import { catalogNameSorted } from "../utils/sort";
import { Button } from "./Button";
import { StoreState } from "../store/types";
import Icon from "./Icon";
import { Mapped } from "../utils/maps";
import { DispatchProps, bumpState, albumEdited } from "../store/actions";
import { editAlbum, addMediaToAlbum, removeMediaFromAlbum } from "../api/album";
import { albumChildren, isAncestor, getAlbum } from "../store/store";
import { Property } from "../utils/StateProxy";

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
    let children = albumChildren(album, catalog);
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
  property: Property<Album | undefined>;
}

class CatalogTreeSelectorComponent extends CatalogTree<SelectorProps & StateProps> {
  protected onAlbumClick(album: Album): void {
    this.props.property.set(album);
  }

  protected onCatalogClick(catalog: Catalog): void {
    this.props.property.set(catalog.root);
  }

  protected renderItem(item: Album, onClick: () => void): React.ReactNode {
    if (this.props.property.get() === item) {
      return <p className="item selected"><Icon iconName="folder-open"/>{item.name}</p>;
    } else {
      return <Button className="item" iconName="folder" onClick={onClick}>{item.name}</Button>;
    }
  }
}

export const CatalogTreeSelector = connect(mapStateToProps)(CatalogTreeSelectorComponent);

interface SidebarProps {
  album?: Album;
  onCatalogClick: (catalog: Catalog) => void;
  onAlbumClick: (album: Album) => void;
}

const mapDispatchToProps = {
  bumpState,
  albumEdited,
};

class CatalogTreeSidebarComponent extends CatalogTree<SidebarProps & StateProps & DispatchProps<typeof mapDispatchToProps>> {
  protected onAlbumClick(album: Album): void {
    this.props.onAlbumClick(album);
  }

  protected onCatalogClick(catalog: Catalog): void {
    this.props.onCatalogClick(catalog);
  }

  private onDragStart: (event: React.DragEvent, album: Album) => void = (event: React.DragEvent, album: Album): void => {
    event.dataTransfer.setData("pixelbin/album", album.id);
    event.dataTransfer.effectAllowed = "move";
  };

  private onDragEnter: ((event: React.DragEvent, album: Album) => void) = (event: React.DragEvent, album: Album): void => {
    let mediaDrag = event.dataTransfer.types.includes("pixelbin/media");
    let albumDrag = event.dataTransfer.types.includes("pixelbin/album");

    if (!mediaDrag && !albumDrag) {
      return;
    }

    let albumMediaDrag = mediaDrag ? event.dataTransfer.types.includes("pixelbin/album-media") : false;
    let effect = event.dataTransfer.dropEffect;

    if (albumMediaDrag) {
      if (effect !== "link" && effect !== "copy" && effect !== "move") {
        return;
      }

      let data = JSON.parse(event.dataTransfer.getData("pixelbin/album-media"));
      // Can't drop into the same album.
      if (data.album === album.id) {
        return;
      }

      event.currentTarget.classList.add("dragtarget");
      event.preventDefault();
    } else if (mediaDrag) {
      if (effect !== "link" && effect !== "copy") {
        return;
      }

      event.currentTarget.classList.add("dragtarget");
      event.preventDefault();
    } else {
      if (event.dataTransfer.dropEffect !== "move") {
        return;
      }

      let id = event.dataTransfer.getData("pixelbin/album");
      // Can't drop onto itself.
      if (album.id === id) {
        return;
      }

      let actualAlbum = getAlbum(id);
      if (!actualAlbum) {
        return;
      }
      // Can't drop onto it's current parent
      if (actualAlbum.parent === album.id) {
        return;
      }

      // Can't drop onto any descendants.
      if (isAncestor(actualAlbum, album)) {
        return;
      }

      event.currentTarget.classList.add("dragtarget");
      event.preventDefault();
    }
  };

  private onDragOver: ((event: React.DragEvent, album: Album) => void) = (event: React.DragEvent, album: Album): void => {
    this.onDragEnter(event, album);
  };

  private onDragLeave: ((event: React.DragEvent, album: Album) => void) = (event: React.DragEvent): void => {
    event.currentTarget.classList.remove("dragtarget");
  };

  private onDrop: ((event: React.DragEvent, album: Album) => Promise<void>) = async (event: React.DragEvent, album: Album): Promise<void> => {
    event.currentTarget.classList.remove("dragtarget");

    let mediaDrag = event.dataTransfer.types.includes("pixelbin/media");
    let albumDrag = event.dataTransfer.types.includes("pixelbin/album");
    if (!mediaDrag && !albumDrag) {
      return;
    }

    let albumMediaDrag = mediaDrag ? event.dataTransfer.types.includes("pixelbin/album-media") : false;
    let effect = event.dataTransfer.dropEffect;

    if ((mediaDrag && (effect === "link" || effect === "copy")) ||
        (albumMediaDrag && effect === "move")) {
      event.preventDefault();

      let mediaId: string;
      if (effect === "move") {
        let data = JSON.parse(event.dataTransfer.getData("pixelbin/album-media"));
        mediaId = data.media;
        removeMediaFromAlbum(data.album, [mediaId]);
      } else {
        mediaId = event.dataTransfer.getData("pixelbin/media");
      }

      try {
        await addMediaToAlbum(album, [mediaId]);
        this.props.bumpState();
      } catch (e) {
        // TODO
      }
    } else if (albumDrag && effect === "move") {
      event.preventDefault();

      let albumId = event.dataTransfer.getData("pixelbin/album");
      try {
        let updated = await editAlbum({
          id: albumId,
          parent: album.id,
        });
        this.props.albumEdited(updated);
        this.props.bumpState();
      } catch (e) {
        // TODO
      }

    }
  };

  protected renderItem(album: Album, onClick: () => void): React.ReactNode {
    let isRoot = !album.parent;

    const dragProps = {
      draggable: !isRoot,
      onDragStart: (event: React.DragEvent): void => this.onDragStart(event, album),
      onDragEnter: (event: React.DragEvent): void => this.onDragEnter(event, album),
      onDragOver: (event: React.DragEvent): void => this.onDragOver(event, album),
      onDragLeave: (event: React.DragEvent): void => this.onDragLeave(event, album),
      onDrop: (event: React.DragEvent): Promise<void> => this.onDrop(event, album),
    };

    if (this.props.album === album) {
      return <p className="item selected" {...dragProps}><Icon iconName="folder-open"/>{album.name}</p>;
    } else {
      return <Button className="item" {...dragProps} iconName="folder" onClick={onClick}>{album.name}</Button>;
    }
  }
}

export const CatalogTreeSidebar = connect(mapStateToProps, mapDispatchToProps)(CatalogTreeSidebarComponent);
