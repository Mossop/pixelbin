import { ReactLocalization } from "@fluent/react";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import PeopleIcon from "@material-ui/icons/People";
import PermMediaIcon from "@material-ui/icons/PermMedia";
import PersonIcon from "@material-ui/icons/Person";
import PhotoAlbumIcon from "@material-ui/icons/PhotoAlbum";
import StorageIcon from "@material-ui/icons/Storage";
import { Draft } from "immer";
import React from "react";

import { Album, Catalog, Person, Tag } from "../api/highlevel";
import { PageType } from "../pages/types";
import { UIState } from "../store/types";
import { ReactResult } from "./types";

export type VirtualItemFilter = (item: VirtualItem) => boolean;

export enum IncludeVirtualCategories {
  Always,
  IfNeeded,
  IfNotEmpty,
}

export interface VirtualTreeOptions {
  filter?: VirtualItemFilter;
  categories?: IncludeVirtualCategories;
}

export function filtered(
  options: VirtualTreeOptions,
  filter: VirtualItemFilter,
): VirtualTreeOptions {
  return {
    ...options,
    filter: (item: VirtualItem): boolean => {
      return filter(item) && (!options.filter || options.filter(item));
    },
  };
}

function descend(items: VirtualItem[], treeOptions: VirtualTreeOptions): VirtualItem[] {
  if (!treeOptions.filter) {
    return items;
  }

  let filter = treeOptions.filter;

  return items.filter((item: VirtualItem): boolean => filter(item));
}

export interface VirtualItem {
  readonly id: string;
  readonly link: Draft<UIState> | null;
  readonly label: (l10n: ReactLocalization) => string;
  readonly icon: () => ReactResult;
  readonly children: VirtualItem[];
}

abstract class BaseVirtualItem implements VirtualItem {
  protected constructor(
    public readonly id: string,
    protected readonly treeOptions: VirtualTreeOptions,
  ) {}

  public get link(): Draft<UIState> | null {
    return null;
  }

  public abstract label(l10n: ReactLocalization): string;

  public icon(): ReactResult {
    return null;
  }

  public get children(): VirtualItem[] {
    return [];
  }
}

abstract class BaseVirtualCatalogItem extends BaseVirtualItem {
}

class VirtualCatalogAlbums extends BaseVirtualCatalogItem {
  public constructor(
    private readonly catalog: Catalog,
    treeOptions: VirtualTreeOptions,
  ) {
    super("albumlist", treeOptions);
  }

  public label(l10n: ReactLocalization): string {
    return l10n.getString("catalog-albums");
  }

  public icon(): ReactResult {
    return <PermMediaIcon/>;
  }

  public get children(): VirtualItem[] {
    return descend(
      this.catalog.rootAlbums.map((album: Album) => album.virtual(this.treeOptions)),
      this.treeOptions,
    );
  }
}

class VirtualCatalogTags extends BaseVirtualCatalogItem {
  public constructor(
    private readonly catalog: Catalog,
    treeOptions: VirtualTreeOptions,
  ) {
    super("taglist", treeOptions);
  }

  public label(l10n: ReactLocalization): string {
    return l10n.getString("catalog-tags");
  }

  public icon(): ReactResult {
    return <LocalOfferIcon/>;
  }

  public get children(): VirtualItem[] {
    return descend(
      this.catalog.rootTags.map((tag: Tag) => tag.virtual(this.treeOptions)),
      this.treeOptions,
    );
  }
}

class VirtualCatalogPeople extends BaseVirtualCatalogItem {
  public constructor(
    private readonly catalog: Catalog,
    treeOptions: VirtualTreeOptions,
  ) {
    super("personlist", treeOptions);
  }

  public label(l10n: ReactLocalization): string {
    return l10n.getString("catalog-people");
  }

  public icon(): ReactResult {
    return <PeopleIcon/>;
  }

  public get children(): VirtualItem[] {
    return descend(
      this.catalog.people.map((person: Person) => person.virtual(this.treeOptions)),
      this.treeOptions,
    );
  }
}

export class VirtualCatalog extends BaseVirtualItem {
  public constructor(
    public readonly catalog: Catalog,
    treeOptions: VirtualTreeOptions = VirtualTree.All,
  ) {
    super(catalog.id, treeOptions);
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

  public icon(): ReactResult {
    return <StorageIcon/>;
  }

  public get children(): VirtualItem[] {
    let results = descend([
      new VirtualCatalogAlbums(this.catalog, this.treeOptions),
      new VirtualCatalogTags(this.catalog, this.treeOptions),
      new VirtualCatalogPeople(this.catalog, this.treeOptions),
    ], this.treeOptions);

    if (this.treeOptions.categories == IncludeVirtualCategories.IfNeeded ||
      this.treeOptions.categories == IncludeVirtualCategories.IfNotEmpty) {
      results = results.filter((item: VirtualItem): boolean => item.children.length > 0);

      if (this.treeOptions.categories == IncludeVirtualCategories.IfNeeded && results.length == 1) {
        results = results[0].children;
      }
    }

    return results;
  }
}

export class VirtualAlbum extends BaseVirtualItem {
  public constructor(
    public readonly album: Album,
    treeOptions: VirtualTreeOptions = VirtualTree.All,
  ) {
    super(album.id, treeOptions);
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

  public icon(): ReactResult {
    return <PhotoAlbumIcon/>;
  }

  public get children(): VirtualItem[] {
    return descend(this.album.children.map(
      (album: Album): VirtualAlbum => album.virtual(this.treeOptions),
    ), this.treeOptions);
  }
}

export class VirtualTag extends BaseVirtualItem {
  public constructor(
    public readonly tag: Tag,
    treeOptions: VirtualTreeOptions = VirtualTree.All,
  ) {
    super(tag.id, treeOptions);
  }

  public label(): string {
    return this.tag.name;
  }

  public icon(): ReactResult {
    return <LocalOfferIcon/>;
  }

  public get children(): VirtualItem[] {
    return descend(this.tag.children.map(
      (tag: Tag): VirtualTag => tag.virtual(this.treeOptions),
    ), this.treeOptions);
  }
}

export class VirtualPerson extends BaseVirtualItem {
  public constructor(
    public readonly person: Person,
    treeOptions: VirtualTreeOptions = VirtualTree.All,
  ) {
    super(person.id, treeOptions);
  }

  public label(): string {
    return this.person.name;
  }

  public icon(): ReactResult {
    return <PersonIcon/>;
  }
}

/* eslint-disable @typescript-eslint/naming-convention */
export const VirtualTree: Record<string, VirtualTreeOptions> = {
  All: {},
  Albums: {
    filter: (item: VirtualItem): boolean => {
      return item instanceof VirtualAlbum || item instanceof BaseVirtualCatalogItem;
    },
    categories: IncludeVirtualCategories.IfNeeded,
  },
  Tags: {
    filter: (item: VirtualItem): boolean => {
      return item instanceof VirtualTag || item instanceof BaseVirtualCatalogItem;
    },
    categories: IncludeVirtualCategories.IfNeeded,
  },
  People: {
    filter: (item: VirtualItem): boolean => {
      return item instanceof VirtualPerson || item instanceof BaseVirtualCatalogItem;
    },
    categories: IncludeVirtualCategories.IfNeeded,
  },
};
/* eslint-enable @typescript-eslint/naming-convention */
