import React, { ReactNode, PureComponent } from "react";

import { Obj } from "../../../utils";
import { Reference } from "../api/highlevel";
import { MediaTarget } from "../api/media";
import { UserState } from "../api/types";
import { document } from "../environment";
import { PageState, PageType } from "../pages/types";
import actions from "../store/actions";
import { StoreState } from "../store/types";
import { ComponentProps, connect } from "../utils/component";
import AlbumOverlay from "./album";
import CatalogOverlay from "./catalog";
import LoginOverlay from "./login";
import SignupOverlay from "./signup";
import { OverlayState, OverlayType } from "./types";
import UploadOverlay from "./upload";

interface FromStateProps {
  page: PageState;
  overlay?: OverlayState;
  user: UserState | null;
}

function mapStateToProps(state: StoreState): FromStateProps {
  return {
    page: state.ui.page,
    overlay: state.ui.overlay,
    user: state.serverState.user,
  };
}

const mapDispatchToProps = {
  closeOverlay: actions.closeOverlay,
};

class OverlayDisplay extends PureComponent<
  ComponentProps<Obj, typeof mapStateToProps, typeof mapDispatchToProps>
> {
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

  public render(): ReactNode {
    let overlayState = this.props.overlay;
    if (!overlayState) {
      return null;
    }

    let overlay: ReactNode = null;
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
          let target: Reference<MediaTarget> | undefined = undefined;
          if (this.props.page.type == PageType.Catalog) {
            target = this.props.page.catalog;
          } else if (this.props.page.type == PageType.Album) {
            target = this.props.page.album;
          }

          overlay = <UploadOverlay target={target}/>;
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

export default connect()(OverlayDisplay, mapStateToProps, mapDispatchToProps);
