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
  public componentDidMount(): void {
    document.addEventListener("keydown", this.onKeyDown, true);
  }

  public componentWillUnmount(): void {
    document.removeEventListener("keydown", this.onKeyDown, true);
  }

  private onClick = (event: React.MouseEvent): void => {
    if (event.target == event.currentTarget) {
      event.preventDefault();
      event.stopPropagation();

      this.props.closeOverlay();
    }
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    console.log(event.key);
    if (event.key == "Escape") {
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
