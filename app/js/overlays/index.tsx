import React from "react";
import { connect } from "react-redux";

import { StoreState, OverlayState, OverlayType } from "../store/types";
import LoginOverlay from "./login";
import SignupOverlay from "./signup";
import UploadOverlay from "./upload";
import CatalogOverlay from "./catalog";
import AlbumOverlay from "./album";
import { closeOverlay, DispatchProps } from "../store/actions";
import { User } from "../api/types";

function mapStateToProps(state: StoreState): StateProps {
  return {
    overlay: state.overlay,
    user: state.serverState.user,
  };
}

const mapDispatchToProps = {
  closeOverlay,
};

interface StateProps {
  overlay?: OverlayState;
  user?: User;
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
    if (!this.props.overlay) {
      return null;
    }

    let overlay: React.ReactNode = null;
    let className = "";

    if (!this.props.user) {
      switch (this.props.overlay.type) {
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
      switch (this.props.overlay.type) {
        case OverlayType.CreateCatalog: {
          overlay = <CatalogOverlay user={this.props.user}/>;
          break;
        }
        case OverlayType.EditCatalog: {
          overlay = <CatalogOverlay user={this.props.user} catalog={this.props.overlay.catalog}/>;
          break;
        }
        case OverlayType.CreateAlbum: {
          overlay = <AlbumOverlay user={this.props.user} parent={this.props.overlay.parent}/>;
          break;
        }
        case OverlayType.EditAlbum: {
          overlay = <AlbumOverlay user={this.props.user} album={this.props.overlay.album}/>;
          break;
        }
        case OverlayType.Upload: {
          overlay = <UploadOverlay user={this.props.user} parent={this.props.overlay.parent}/>;
          break;
        }
      }
    }

    if (!overlay) {
      console.error(`State contained an illegal overlay: ${this.props.overlay.type}`);
      this.props.closeOverlay();
      return null;
    }

    className = this.props.overlay.type;

    return <div id="overlay" className={className} onClick={this.onClick}>
      {overlay}
    </div>;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(OverlayDisplay);
