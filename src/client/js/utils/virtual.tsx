import { ReactLocalization } from "@fluent/react";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import PermMediaIcon from "@material-ui/icons/PermMedia";
import PersonIcon from "@material-ui/icons/Person";
import PhotoAlbumIcon from "@material-ui/icons/PhotoAlbum";
import StorageIcon from "@material-ui/icons/Storage";
import { Draft } from "immer";
import React from "react";

import { Album, Catalog, Person, Tag } from "../api/highlevel";
import { PageType } from "../pages/types";
import { UIState } from "../store/types";

export enum VirtualTreeType {
  All,
  Albums,
  Tags,
  People,
}

export interface VirtualItem {
  readonly id: string;
  readonly link: Draft<UIState> | null;
  readonly label: (l10n: ReactLocalization) => string;
  readonly icon: () => React.ReactElement | null;
  readonly children: VirtualItem[];
}

abstract class BaseVirtualItem implements VirtualItem {
  protected constructor(
    public readonly id: string,
    protected readonly treeType: VirtualTreeType,
  ) {}

  public get link(): Draft<UIState> | null {
    return null;
  }

  public abstract label(l10n: ReactLocalization): string;

  public icon(): React.ReactElement | null {
    return null;
  }

  public get children(): VirtualItem[] {
    return [];
  }
}

class VirtualCatalogAlbums extends BaseVirtualItem {
  public constructor(
    private readonly catalog: Catalog,
    treeType: VirtualTreeType,
  ) {
    super("albumlist", treeType);
  }

  public label(l10n: ReactLocalization): string {
    return l10n.getString("catalog-albums");
  }

  public icon(): React.ReactElement {
    return <PermMediaIcon/>;
  }

  public get children(): VirtualAlbum[] {
    return this.catalog.rootAlbums.map((album: Album) => album.virtual(this.treeType));
  }
}

export class VirtualCatalog extends BaseVirtualItem {
  public constructor(
    public readonly catalog: Catalog,
    treeType: VirtualTreeType = VirtualTreeType.All,
  ) {
    super(catalog.id, treeType);
  }

  public get link(): Draft<UIState> {
    return {
      page: {
        type: PageType.Catalog,
        catalog: this.catalog.ref(),
      },
    };
  }

  public label(): string {
    return this.catalog.name;
  }

  public icon(): React.ReactElement {
    return <StorageIcon/>;
  }

  public get children(): VirtualItem[] {
    switch (this.treeType) {
      case VirtualTreeType.Albums:
        return this.catalog.rootAlbums.map((album: Album) => album.virtual(this.treeType));
      case VirtualTreeType.Tags:
        return this.catalog.rootTags.map((tag: Tag) => tag.virtual(this.treeType));
      case VirtualTreeType.People:
        return this.catalog.people.map((person: Person) => person.virtual(this.treeType));
    }

    return [
      new VirtualCatalogAlbums(this.catalog, this.treeType),
    ];
  }
}

export class VirtualAlbum extends BaseVirtualItem {
  public constructor(
    public readonly album: Album,
    treeType: VirtualTreeType = VirtualTreeType.All,
  ) {
    super(album.id, treeType);
  }

  public get link(): Draft<UIState> {
    return {
      page: {
        type: PageType.Album,
        album: this.album.ref(),
      },
    };
  }

  public label(): string {
    return this.album.name;
  }

  public icon(): React.ReactElement {
    return <PhotoAlbumIcon/>;
  }

  public get children(): VirtualAlbum[] {
    return this.album.children.map(
      (album: Album): VirtualAlbum => album.virtual(this.treeType),
    );
  }
}

export class VirtualTag extends BaseVirtualItem {
  public constructor(
    public readonly tag: Tag,
    treeType: VirtualTreeType = VirtualTreeType.All,
  ) {
    super(tag.id, treeType);
  }

  public label(): string {
    return this.tag.name;
  }

  public icon(): React.ReactElement {
    return <LocalOfferIcon/>;
  }

  public get children(): VirtualTag[] {
    return this.tag.children.map(
      (tag: Tag): VirtualTag => tag.virtual(this.treeType),
    );
  }
}

export class VirtualPerson extends BaseVirtualItem {
  public constructor(
    public readonly person: Person,
    treeType: VirtualTreeType = VirtualTreeType.All,
  ) {
    super(person.id, treeType);
  }

  public label(): string {
    return this.person.name;
  }

  public icon(): React.ReactElement {
    return <PersonIcon/>;
  }
}
