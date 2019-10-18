import React from "react";
import { connect } from "react-redux";

import { StoreState, Overlay, OverlayType } from "../store/types";
import LoginOverlay from "./login";
import SignupOverlay from "./signup";
import UploadOverlay from "./upload";
import CatalogOverlay from "./catalog";
import AlbumOverlay from "./album";
import { closeOverlay, DispatchProps } from "../store/actions";
import { Button } from "../components/Button";

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
    let className = "";
    if (this.props.overlay) {
      switch (this.props.overlay.type) {
        case OverlayType.Login: {
          overlay = <LoginOverlay/>;
          break;
        }
        case OverlayType.Signup: {
          overlay = <SignupOverlay/>;
          break;
        }
        case OverlayType.CreateCatalog: {
          overlay = <CatalogOverlay/>;
          break;
        }
        case OverlayType.EditCatalog: {
          overlay = <CatalogOverlay catalog={this.props.overlay.catalog}/>;
          break;
        }
        case OverlayType.CreateAlbum: {
          overlay = <AlbumOverlay catalog={this.props.overlay.catalog} parent={this.props.overlay.album}/>;
          break;
        }
        case OverlayType.Upload: {
          overlay = <UploadOverlay catalog={this.props.overlay.catalog} album={this.props.overlay.album}/>;
          break;
        }
      }

      className = this.props.overlay.type;
    } else {
      return null;
    }

    return <div id="overlay" className={className} onClick={this.onClick}>
      <div id="overlay-inner">
        <div id="overlay-header">
          <Button iconName="times" tooltipL10n="overlay-close" onClick={this.props.closeOverlay}/>
        </div>
        <div id="overlay-content">{overlay}</div>
      </div>
    </div>;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(OverlayDisplay);
