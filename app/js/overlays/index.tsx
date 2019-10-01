import React from "react";
import { connect } from "react-redux";

import { StoreState, Overlay } from "../types";
import LoginOverlay, { isLoginOverlay } from "./login";

interface OverlayProps {
  overlay?: Overlay;
}

class OverlayDisplay extends React.Component<OverlayProps> {
  public render(): React.ReactNode {
    if (this.props.overlay) {
      if (isLoginOverlay(this.props.overlay)) {
        return <div id="overlay"><LoginOverlay/></div>;
      }
    }

    return null;
  }
}

function mapStateToProps(state: StoreState): object {
  if (state.page) {
    return {
      overlay: state.page.overlay,
    };
  }

  return { overlay: null };
}

export default connect(mapStateToProps)(OverlayDisplay);
