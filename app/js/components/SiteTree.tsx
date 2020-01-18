import { Localized } from "@fluent/react";
import React from "react";
import { connect } from "react-redux";

import { Catalog, Album, catalogs, Reference, Referencable } from "../api/highlevel";
import { MediaTarget } from "../api/media";
import { StoreState } from "../store/types";
import { Property } from "../utils/StateProxy";
import { Button } from "./Button";
import Icon, { IconProps } from "./Icon";
import { ComponentProps, StyleProps, styleProps } from "./shared";

export type TreeItem = Catalog | Album | VirtualTreeItem;

abstract class VirtualTreeItem implements Referencable<VirtualTreeItem> {
  public abstract get id(): string;
  public abstract get name(): React.ReactNode;
  public abstract get classes(): string[];
  public abstract getIcon(selected: boolean): IconProps;
  public abstract get children(): TreeItem[];
  public abstract ref(): Reference<VirtualTreeItem>;
}

type CatalogItemType<K extends keyof typeof CatalogItemBuilders> = InstanceType<typeof CatalogItemBuilders[K]>;
type CatalogItems = {
  [K in keyof typeof CatalogItemBuilders]?: CatalogItemType<K>;
};

abstract class VirtualCatalogItem<K extends keyof CatalogItems> extends VirtualTreeItem {
  private static itemMap: WeakMap<Catalog, CatalogItems> = new WeakMap();
  public static getForCatalog<K extends keyof CatalogItems>(catalog: Catalog, type: K): CatalogItemType<K> {
    let items = VirtualCatalogItem.itemMap.get(catalog);
    if (!items) {
      items = {};
      VirtualCatalogItem.itemMap.set(catalog, items);
    }

    if (!items[type]) {
      items[type] = new CatalogItemBuilders[type](catalog);
    }

    return items[type] as CatalogItemType<K>;
  }

  protected constructor(protected catalog: Catalog, private type: K) {
    super();
  }

  public ref(): Reference<CatalogItemType<K>> {
    let id = this.id;
    let catalogRef = this.catalog.ref();
    return {
      id,
      deref: (state: StoreState): CatalogItemType<K> => {
        return VirtualCatalogItem.getForCatalog(catalogRef.deref(state), this.type);
      },
    };
  }
}

class CatalogAlbums extends VirtualCatalogItem<"albums"> {
  public constructor(catalog: Catalog) {
    super(catalog, "albums");
  }

  public static build(catalog: Catalog): CatalogAlbums {
    return VirtualCatalogItem.getForCatalog(catalog, "albums", );
  }

  public get id(): string {
    return `${this.catalog.id}-albums`;
  }

  public get name(): React.ReactNode {
    return <Localized id="catalog-albums">
      <span/>
    </Localized>;
  }

  public get classes(): string[] {
    return ["item", "albums"];
  }

  public getIcon(selected: boolean): IconProps {
    return { iconName: selected ? "folder-open" : "folder" };
  }

  public get children(): TreeItem[] {
    return this.catalog.rootAlbums;
  }
}

const CatalogItemBuilders = {
  albums: CatalogAlbums,
};

export abstract class BaseSiteTree<P = {}, S = {}> extends React.Component <P, S>{
  protected onItemClicked(_event: React.MouseEvent, _item: TreeItem): void {
    return;
  }

  protected canClick(item: TreeItem): boolean {
    return !this.isSelected(item);
  }

  protected renderItemButton(item: TreeItem, content: React.ReactNode, props: StyleProps & IconProps = {}): React.ReactNode {
    if (typeof content == "string") {
      content = <span>{content}</span>;
    }

    if (this.canClick(item)) {
      let clickHandler = (event: React.MouseEvent): void => this.onItemClicked(event, item);
      return <Button {...props} onClick={clickHandler}>{content}</Button>;
    }
    return <p {...styleProps(props)}><Icon iconStyle={props.iconStyle} iconName={props.iconName}/>{content}</p>;
  }

  protected getClassForItem(item: TreeItem): string[] {
    let classes = this.isSelected(item) ? ["selected"] : [];
    if (item instanceof Catalog) {
      classes.push("item", "catalog");
    } else if (item instanceof Album) {
      classes.push("item", "album");
    } else if (item instanceof VirtualTreeItem) {
      classes.push(...item.classes);
    }
    return classes;
  }

  protected isSelected(_item: TreeItem): boolean {
    return false;
  }

  protected getIconForItem(item: TreeItem): IconProps {
    let selected = this.isSelected(item);
    if (item instanceof Catalog) {
      return { iconName: "archive" };
    }
    if (item instanceof Album) {
      return { iconName: "images" };
    }
    if (item instanceof VirtualTreeItem) {
      return item.getIcon(selected);
    }
    return { iconName: selected ? "folder-open" : "folder" };
  }

  protected getChildren(item: TreeItem): TreeItem[] {
    if (item instanceof Catalog) {
      return [
        CatalogAlbums.build(item),
      ];
    }
    if (item instanceof Album) {
      return item.children;
    }
    if (item instanceof VirtualTreeItem) {
      return item.children;
    }
    return [];
  }

  protected renderItem(item: TreeItem): React.ReactNode {
    return this.renderItemButton(item, item.name, {
      className: this.getClassForItem(item),
      ...this.getIconForItem(item),
    });
  }

  protected renderChild(item: TreeItem, depth: number): React.ReactNode {
    return <li key={item.id} className={`depth${depth}`}>
      {this.renderItem(item)}
      {this.renderItems(this.getChildren(item), depth + 1)}
    </li>;
  }

  protected renderItems(items: TreeItem[], depth: number = 0): React.ReactNode {
    if (items.length) {
      return <ol className={depth == 0 ? "site-tree" : ""}>
        {items.map((i: TreeItem) => this.renderChild(i, depth))}
      </ol>;
    }
    return null;
  }
}

interface MediaTargetSelectorPassedProps {
  roots?: TreeItem[];
  property: Property<Reference<MediaTarget> | undefined>;
}

interface MediaTargetSelectorFromStateProps {
  roots: TreeItem[];
  selected: MediaTarget | undefined;
}

function mapStateToMediaTargetSelectorProps(state: StoreState, ownProps: MediaTargetSelectorPassedProps): MediaTargetSelectorFromStateProps {
  return {
    roots: ownProps.roots || catalogs(state),
    selected: ownProps.property.get()?.deref(state),
  };
}

type MediaTargetSelectorProps = ComponentProps<MediaTargetSelectorPassedProps, typeof mapStateToMediaTargetSelectorProps>;
export class MediaTargetSelectorComponent extends BaseSiteTree<MediaTargetSelectorProps> {
  protected onItemClicked(_event: React.MouseEvent, item: TreeItem): void {
    if (item instanceof Album || item instanceof Catalog) {
      this.props.property.set(item.ref());
    }
  }

  protected getChildren(item: TreeItem): TreeItem[] {
    if (item instanceof Catalog) {
      return item.rootAlbums;
    }
    return super.getChildren(item);
  }

  protected isSelected(item: TreeItem): boolean {
    return this.props.property.get()?.id == item.id;
  }

  protected canClick(item: TreeItem): boolean {
    return !this.isSelected(item) && (item instanceof Album || item instanceof Catalog);
  }

  public render(): React.ReactNode {
    return this.renderItems(this.props.roots);
  }
}

export const MediaTargetSelector = connect(mapStateToMediaTargetSelectorProps)(MediaTargetSelectorComponent);
