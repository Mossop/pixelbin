import React from "react";

import { Catalog, Album, catalogs } from "../api/highlevel";
import { PageType } from "../pages";
import { showCatalogCreateOverlay, navigateAction } from "../store/actions";
import { connect, ComponentProps } from "../store/component";
import { StoreState } from "../store/types";
import Button from "./Button";
import { TreeItem, BaseSiteTree } from "./SiteTree";

interface SidebarTreePassedProps {
  selectedItem?: TreeItem;
}

interface SidebarTreeFromStateProps {
  catalogs: Catalog[];
}

function mapStateToSidebarTreeProps(state: StoreState): SidebarTreeFromStateProps {
  return {
    catalogs: catalogs(state.serverState),
  };
}

const mapDispatchToSidebarTreeProps = {
  navigateAction,
};

class SidebarTreeComponent extends BaseSiteTree<SidebarTreePassedProps, typeof mapStateToSidebarTreeProps, typeof mapDispatchToSidebarTreeProps> {
  protected onItemClicked(_: React.MouseEvent, item: TreeItem): void {
    if (item instanceof Catalog) {
      this.props.navigateAction({
        page: {
          type: PageType.Catalog,
          catalog: item.ref(),
        },
      });
    } else if (item instanceof Album) {
      this.props.navigateAction({
        page: {
          type: PageType.Album,
          album: item.ref(),
        },
      });
    }
  }

  protected canClick(item: TreeItem): boolean {
    return !this.isSelected(item) && (item instanceof Album || item instanceof Catalog);
  }

  protected isSelected(item: TreeItem): boolean {
    return item == this.props.selectedItem;
  }

  public render(): React.ReactNode {
    return this.renderItems(this.props.catalogs);
  }
}
const SidebarTree = connect<SidebarTreePassedProps>()(SidebarTreeComponent, mapStateToSidebarTreeProps, mapDispatchToSidebarTreeProps);

const mapDispatchToProps = {
  showCatalogCreateOverlay: showCatalogCreateOverlay,
};

interface SidebarPassedProps {
  selectedItem?: TreeItem;
}

class Sidebar extends React.Component<ComponentProps<SidebarPassedProps, {}, typeof mapDispatchToProps>> {
  public render(): React.ReactNode {
    return <div id="sidebar">
      <div id="catalog-tree">
        <SidebarTree selectedItem={this.props.selectedItem}/>
        <Button id="new-catalog" l10n="sidebar-add-catalog" iconName="folder-plus" onClick={this.props.showCatalogCreateOverlay}/>
      </div>
    </div>;
  }
}

export default connect<SidebarPassedProps>()(Sidebar, undefined, mapDispatchToProps);
