import React from "react";
import { connect } from "react-redux";

import { StoreState, OverlayState, OverlayType } from "../store/types";
import { closeOverlay } from "../store/actions";
import LoginOverlay from "./login";
import SignupOverlay from "./signup";
import UploadOverlay from "./upload";
import CatalogOverlay from "./catalog";
import AlbumOverlay from "./album";
import { Immutable } from "../utils/immer";
import { ComponentProps } from "../components/shared";
import { UserData } from "../api/types";

interface FromStateProps {
  overlay?: OverlayState;
  user: Immutable<UserData> | null;
}

function mapStateToProps(state: StoreState): FromStateProps {
  return {
    overlay: state.overlay,
    user: state.serverState.user,
  };
}

const mapDispatchToProps = {
  closeOverlay,
};

type OverlayDisplayProps = ComponentProps<{}, typeof mapStateToProps, typeof mapDispatchToProps>;
class OverlayDisplay extends React.Component<OverlayDisplayProps> {
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
    let overlayState = this.props.overlay;
    if (!overlayState) {
      return null;
    }

    let overlay: React.ReactNode = null;
    let className = "";

    if (!this.props.user) {
      switch (overlayState.type) {
        case OverlayType.Login: {
          overlay = <LoginOverlay/>;
          break;
        }
        case OverlayType.Signup: {
          overlay = <SignupOverlay/>;
          break;
        }
      }
    } else {
      switch (overlayState.type) {
        case OverlayType.CreateCatalog: {
          overlay = <CatalogOverlay user={this.props.user}/>;
          break;
        }
        case OverlayType.CreateAlbum: {
          overlay = <AlbumOverlay parent={overlayState.parent}/>;
          break;
        }
        case OverlayType.EditAlbum: {
          overlay = <AlbumOverlay album={overlayState.album}/>;
          break;
        }
        case OverlayType.Upload: {
          overlay = <UploadOverlay target={overlayState.target}/>;
          break;
        }
      }
    }

    if (!overlay) {
      console.error(`State contained an illegal overlay: ${overlayState.type}`);
      this.props.closeOverlay();
      return null;
    }

    className = overlayState.type;

    return <div id="overlay" className={className} onClick={this.onClick}>
      <div id="overlay-pane">{overlay}</div>
    </div>;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(OverlayDisplay);
