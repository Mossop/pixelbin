import React from "react";
import { connect } from "react-redux";

import { StoreState, Overlay } from "../types";
import LoginOverlay, { isLoginOverlay } from "./login";
import SignupOverlay, { isSignupOverlay } from "./signup";
import CreateCatalogOverlay, { isCreateCatalogOverlay } from "./catalog";
import { closeOverlay, DispatchProps } from "../utils/actions";

function mapStateToProps(state: StoreState): StateProps {
  return {
    overlay: state.overlay,
  };
}

const mapDispatchToProps = {
  closeOverlay,
};

interface StateProps {
  overlay?: Overlay;
}

class OverlayDisplay extends React.Component<StateProps & DispatchProps<typeof mapDispatchToProps>> {
  public componentDidMount(): void {
    document.addEventListener("keydown", this.onKeyDown, true);
  }

  public componentWillUnmount(): void {
    document.removeEventListener("keydown", this.onKeyDown, true);
  }

  private onClick: ((event: React.MouseEvent) => void) = (event: React.MouseEvent): void => {
    if (event.target == event.currentTarget) {
      event.preventDefault();
      event.stopPropagation();

      this.props.closeOverlay();
    }
  };

  private onKeyDown: ((event: KeyboardEvent) => void) = (event: KeyboardEvent): void => {
    if (event.key == "Escape") {
      event.preventDefault();
      event.stopPropagation();

      this.props.closeOverlay();
    }
  };

  public render(): React.ReactNode {
    let overlay: React.ReactNode;
    if (this.props.overlay) {
      if (isLoginOverlay(this.props.overlay)) {
        overlay = <LoginOverlay/>;
      } else if (isSignupOverlay(this.props.overlay)) {
        overlay = <SignupOverlay/>;
      } else if (isCreateCatalogOverlay(this.props.overlay)) {
        overlay = <CreateCatalogOverlay/>;
      } else {
        return null;
      }
    } else {
      return null;
    }

    return <div id="overlay" onClick={this.onClick}>{overlay}</div>;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(OverlayDisplay);
