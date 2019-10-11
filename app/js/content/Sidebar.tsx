import React from "react";
import { Localized } from "@fluent/react";
import { connect } from "react-redux";

import { showCatalogCreateOverlay, DispatchProps } from "../utils/actions";

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
      <ol>
      </ol>
      <Localized id="sidebar-add-category">
        <button onClick={this.onClick}/>
      </Localized>
      <p>Add a new category...</p>
    </div>;
  }
}

export default connect(null, mapDispatchToProps)(Sidebar);
