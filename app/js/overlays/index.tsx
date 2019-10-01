import React from "react";
import { connect } from "react-redux";

import { StoreState, Overlay } from "../types";
import LoginOverlay, { isLoginOverlay } from "./login";
import { closeOverlay, DispatchProps } from "../utils/actions";

function mapStateToProps(state: StoreState): OverlayProps {
  return {
    overlay: state.overlay,
  };
}

const mapDispatchToProps = {
  closeOverlay,
};

interface OverlayProps {
  overlay?: Overlay;
}

class OverlayDisplay extends React.Component<OverlayProps & DispatchProps<typeof mapDispatchToProps>> {
  private onClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>): void => {
    if (event.target == event.currentTarget) {
      event.preventDefault();
      event.stopPropagation();

      this.props.closeOverlay();
    }
  };

  public render(): React.ReactNode {
    if (this.props.overlay) {
      if (isLoginOverlay(this.props.overlay)) {
        return <div id="overlay" onClick={this.onClick}><LoginOverlay/></div>;
      }
    }

    return null;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(OverlayDisplay);
