import { Localized } from "@fluent/react";
import React from "react";

import { editAlbum, createAlbum } from "../api/album";
import { Patch } from "../api/helpers";
import { Album, Catalog, Reference, Derefer, derefer } from "../api/highlevel";
import { MediaTarget } from "../api/media";
import { AlbumCreateData } from "../api/types";
import Form, { FormField } from "../components/Form";
import Overlay from "../components/Overlay";
import { MediaTargetSelector } from "../components/SiteTree";
import { albumCreated, albumEdited } from "../store/actions";
import { ComponentProps, connect } from "../store/component";
import { StoreState } from "../store/types";
import { exception, ErrorCode, AppError } from "../utils/exception";
import { focus } from "../utils/helpers";
import { proxyReactState, makeProperty } from "../utils/StateProxy";

interface InputFields {
  name: string;
  parent: Reference<MediaTarget> | undefined;
}

interface PassedProps {
  album?: Reference<Album>;
  parent?: Reference<MediaTarget>;
}

interface FromStateProps {
  album: Album | undefined;
  parent: MediaTarget | undefined;
  deref: Derefer;
}

function mapStateToProps(state: StoreState, ownProps: PassedProps): FromStateProps {
  if (!ownProps.album && !ownProps.parent) {
    exception(ErrorCode.InvalidState);
  }

  let album = ownProps.album?.deref(state.serverState);
  return {
    album,
    parent: album ? album.parent : ownProps.parent?.deref(state.serverState),
    deref: derefer(state.serverState),
  };
}

const mapDispatchToProps = {
  albumCreated,
  albumEdited,
};

interface AlbumOverlayState {
  disabled: boolean;
  error?: AppError;
  inputs: InputFields;
}

type AlbumOverlayProps = ComponentProps<PassedProps, typeof mapStateToProps, typeof mapDispatchToProps>;
class AlbumOverlay extends React.Component<AlbumOverlayProps, AlbumOverlayState> {
  private inputs: InputFields;

  public constructor(props: AlbumOverlayProps) {
    super(props);

    this.state = {
      disabled: false,
      inputs: {
        parent: this.props.parent?.ref(),
        name: "",
      },
    };

    if (this.props.album) {
      this.state.inputs.name = this.props.album.name;
    }

    this.inputs = proxyReactState(this, "inputs");
  }

  public componentDidMount(): void {
    focus("album-overlay-name");
  }

  private onSubmit: (() => Promise<void>) = async(): Promise<void> => {
    let name = this.inputs.name;
    if (!name) {
      return;
    }

    let parent = this.props.deref(this.inputs.parent);
    if (!parent) {
      exception(ErrorCode.InvalidState);
    }

    this.setState({ disabled: true, error: undefined });

    try {
      if (!this.props.album) {
        let catalog = parent instanceof Catalog ? parent : parent.catalog;
        let album = parent instanceof Catalog ? null : parent;
        let data: AlbumCreateData = {
          catalog: catalog.ref(),
          name,
          parent: album?.ref(),
        };

        let albumData= await createAlbum(data);
        this.props.albumCreated(albumData);
      } else {
        let catalog = parent instanceof Catalog ? parent : parent.catalog;
        let album = parent instanceof Catalog ? null : parent;
        let updated: Patch<AlbumCreateData, Album> = {
          catalog: catalog.ref(),
          name,
          id: this.props.album.ref(),
          parent: album?.ref(),
        };
        let albumData = await editAlbum(updated);
        this.props.albumEdited(albumData);
      }
    } catch (e) {
      this.setState({ disabled: false, error: e });
    }
  };

  public renderSidebar(): React.ReactNode {
    let title = this.props.album ? "album-edit-sidebar" : "album-create-sidebar";

    return <React.Fragment>
      <div className="sidebar-item">
        <Localized id={title}><label className="title"/></Localized>
      </div>
      <MediaTargetSelector property={makeProperty(this.inputs, "parent")}/>
    </React.Fragment>;
  }

  public render(): React.ReactNode {
    let title = this.props.album ? "album-edit-title" : "album-create-title";

    return <Overlay title={title} error={this.state.error} sidebar={this.renderSidebar()}>
      <Form orientation="column" disabled={this.state.disabled} onSubmit={this.onSubmit} submit={this.props.album ? "album-edit-submit" : "album-create-submit"}>
        <FormField id="album-overlay-name" type="text" labelL10n="album-name" iconName="folder" required={true} property={makeProperty(this.inputs, "name")}/>
      </Form>
    </Overlay>;
  }
}

export default connect<PassedProps>()(AlbumOverlay, mapStateToProps, mapDispatchToProps);
