import React from "react";
import { connect } from "react-redux";

import { showCatalogCreateOverlay, DispatchProps } from "../utils/actions";
import { Button } from "../components/Button";

const mapDispatchToProps = {
  showCatalogCreateOverlay: showCatalogCreateOverlay,
};

type SidebarProps = DispatchProps<typeof mapDispatchToProps>;

class Sidebar extends React.Component<SidebarProps> {
  private onClick: (() => void) = (): void => {
    this.props.showCatalogCreateOverlay();
  };

  public render(): React.ReactNode {
    return <div id="sidebar">
      <div id="catalog-list">
        <ol>
        </ol>
        <p><Button l10n="sidebar-add-category" iconName="folder-plus" onClick={this.onClick}/></p>
      </div>
    </div>;
  }
}

export default connect(null, mapDispatchToProps)(Sidebar);
