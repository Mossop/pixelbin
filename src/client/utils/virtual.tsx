import type { ReactLocalization } from "@fluent/react";
import type { Draft } from "immer";
import React from "react";

import { nameSorted } from "../../utils/sort";
import type { Album, Catalog, Person, SavedSearch, Tag } from "../api/highlevel";
import AlbumIcon from "../icons/AlbumIcon";
import AlbumsIcon from "../icons/AlbumsIcon";
import CatalogIcon from "../icons/CatalogIcon";
import PeopleIcon from "../icons/PeopleIcon";
import PersonIcon from "../icons/PersonIcon";
import SavedSearchesIcon from "../icons/SavedSearchesIcon";
import SavedSearchIcon from "../icons/SavedSearchIcon";
import TagIcon from "../icons/TagIcon";
import TagsIcon from "../icons/TagsIcon";
import { PageType } from "../pages/types";
import type { UIState } from "../store/types";
import type { ReactResult } from "./types";

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

export abstract class BaseVirtualCatalogItem extends BaseVirtualItem {
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
    return <AlbumsIcon/>;
  }

  public get children(): VirtualItem[] {
    let albums = nameSorted(this.catalog.rootAlbums);
    return descend(
      albums.map((album: Album) => album.virtual(this.treeOptions)),
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
    return <TagsIcon/>;
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

class VirtualCatalogSearches extends BaseVirtualCatalogItem {
  public constructor(
    private readonly catalog: Catalog,
    treeOptions: VirtualTreeOptions,
  ) {
    super("searchlist", treeOptions);
  }

  public label(l10n: ReactLocalization): string {
    return l10n.getString("catalog-searches");
  }

  public icon(): ReactResult {
    return <SavedSearchesIcon/>;
  }

  public get children(): VirtualItem[] {
    let searches = nameSorted(this.catalog.searches);
    return descend(
      searches.map((search: SavedSearch) => search.virtual(this.treeOptions)),
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
    return <CatalogIcon/>;
  }

  public get children(): VirtualItem[] {
    let results = descend([
      new VirtualCatalogSearches(this.catalog, this.treeOptions),
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
    return <AlbumIcon/>;
  }

  public get children(): VirtualItem[] {
    let children = nameSorted(this.album.children);
    return descend(children.map(
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
    return <TagIcon/>;
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

export class VirtualSearch extends BaseVirtualItem {
  public constructor(
    public readonly search: SavedSearch,
    treeOptions: VirtualTreeOptions = VirtualTree.All,
  ) {
    super(search.id, treeOptions);
  }

  public get link(): Draft<UIState> {
    return {
      page: {
        type: PageType.SavedSearch,
        search: this.search.ref(),
      },
    };
  }

  public label(): string {
    return this.search.name;
  }

  public icon(): ReactResult {
    return <SavedSearchIcon/>;
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
  Searches: {
    filter: (item: VirtualItem): boolean => {
      return item instanceof VirtualSearch || item instanceof BaseVirtualCatalogItem;
    },
    categories: IncludeVirtualCategories.IfNeeded,
  },
};
/* eslint-enable @typescript-eslint/naming-convention */
