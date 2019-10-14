import React from "react";
import { connect } from "react-redux";

import { showCatalogCreateOverlay, DispatchProps } from "../utils/actions";
import { Button } from "../components/Button";
import { StoreState, Catalog } from "../types";
import { history } from "../utils/history";

const mapDispatchToProps = {
  showCatalogCreateOverlay: showCatalogCreateOverlay,
};

interface StateProps {
  catalogs: Catalog[];
}

function mapStateToProps(state: StoreState): StateProps {
  if (state.serverState.user) {
    return { catalogs: state.serverState.user.catalogs };
  }
  return { catalogs: [] };
}

type SidebarProps = DispatchProps<typeof mapDispatchToProps> & StateProps & {
  selected?: string;
};

class Sidebar extends React.Component<SidebarProps> {
  private onCatalogClick: ((catalog: Catalog) => void) = (catalog: Catalog): void => {
    history.push(`/catalog/${catalog.id}`);
  };

  private renderCatalog(catalog: Catalog): React.ReactNode {
    let className = ["depth0"];
    if (this.props.selected == catalog.id) {
      className.push("selected");
    }
    return <li key={catalog.id} className={className.join(" ")}>
      <Button disabled={this.props.selected == catalog.id} iconName="folder" onClick={(): void => this.onCatalogClick(catalog)}>{catalog.name}</Button>
    </li>;
  }

  public render(): React.ReactNode {
    return <div id="sidebar">
      <div id="catalog-list">
        <ol>
          {this.props.catalogs.map((c: Catalog) => this.renderCatalog(c))}
        </ol>
        <p><Button l10n="sidebar-add-category" iconName="folder-plus" onClick={this.props.showCatalogCreateOverlay}/></p>
      </div>
    </div>;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Sidebar);
