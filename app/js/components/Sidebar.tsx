import React from "react";
import { connect } from "react-redux";

import { showCatalogCreateOverlay } from "../store/actions";
import { StoreState } from "../store/types";
import { history } from "../utils/history";
import { TreeItem, BaseSiteTree } from "./SiteTree";
import { Button } from "./Button";
import { Catalog, Album, catalogs } from "../api/highlevel";
import { ComponentProps } from "./shared";
import { IconProps } from "./Icon";

interface SidebarTreePassedProps {
  selectedItem?: TreeItem;
}

interface SidebarTreeFromStateProps {
  catalogs: Catalog[];
}

function mapStateToSidebarTreeProps(state: StoreState): SidebarTreeFromStateProps {
  return {
    catalogs: catalogs(state),
  };
}

type SidebarTreeProps = ComponentProps<SidebarTreePassedProps, typeof mapStateToSidebarTreeProps>;
class SidebarTreeComponent extends BaseSiteTree<SidebarTreeProps> {
  protected onItemClicked(_: React.MouseEvent, item: TreeItem): void {
    if (item instanceof Catalog) {
      history.push(`/catalog/${item.id}`);
    } else if (item instanceof Album) {
      history.push(`/album/${item.id}`);
    }
  }

  protected canClick(item: TreeItem): boolean {
    return item != this.props.selectedItem && (item instanceof Album || item instanceof Catalog);
  }

  protected getClassForItem(item: TreeItem): string[] {
    let classes = super.getClassForItem(item);
    if (item == this.props.selectedItem) {
      classes.push("selected");
    }
    return classes;
  }

  protected getIconForItem(item: TreeItem): IconProps {
    if (item == this.props.selectedItem) {
      return { iconName: "folder-open" };
    }
    return super.getIconForItem(item);
  }

  public render(): React.ReactNode {
    return this.renderItems(this.props.catalogs);
  }
}
const SidebarTree = connect(mapStateToSidebarTreeProps)(SidebarTreeComponent);

const mapDispatchToProps = {
  showCatalogCreateOverlay: showCatalogCreateOverlay,
};

interface SidebarPassedProps {
  selectedItem?: TreeItem;
}

export type SidebarProps = ComponentProps<SidebarPassedProps, {}, typeof mapDispatchToProps>;
class Sidebar extends React.Component<SidebarProps> {
  public render(): React.ReactNode {
    return <div id="sidebar">
      <div id="catalog-tree">
        <SidebarTree selectedItem={this.props.selectedItem}/>
        <Button id="new-catalog" l10n="sidebar-add-catalog" iconName="folder-plus" onClick={this.props.showCatalogCreateOverlay}/>
      </div>
    </div>;
  }
}

export default connect(null, mapDispatchToProps)(Sidebar);
