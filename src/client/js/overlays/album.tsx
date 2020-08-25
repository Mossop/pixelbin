import { Localized } from "@fluent/react";
import React, { ReactNode, Fragment, PureComponent } from "react";

import { editAlbum, createAlbum } from "../api/album";
import { Album, Catalog, Reference, Derefer, dereferencer } from "../api/highlevel";
import { MediaTarget } from "../api/media";
import { AlbumState, Create, Patch } from "../api/types";
import Form, { FormField } from "../components/Form";
import Overlay from "../components/Overlay";
import { MediaTargetSelector } from "../components/SiteTree";
import actions from "../store/actions";
import { StoreState } from "../store/types";
import { ComponentProps, connect } from "../utils/component";
import { exception, ErrorCode, AppError } from "../utils/exception";
import { focus } from "../utils/helpers";
import { proxyReactState, makeProperty } from "../utils/StateProxy";

interface InputFields {
  name: string;
  parent: Reference<MediaTarget> | undefined;
}

interface EditPassedProps {
  album: Reference<Album>;
}

interface CreatePassedProps {
  parent: Reference<MediaTarget>;
}

type PassedProps = EditPassedProps | CreatePassedProps;

interface FromStateProps {
  album: Album | undefined;
  parent: MediaTarget | undefined;
  deref: Derefer;
}

function mapStateToProps(state: StoreState, ownProps: PassedProps): FromStateProps {
  if ("album" in ownProps) {
    let album = ownProps.album.deref(state.serverState);
    return {
      album,
      parent: album.parent,
      deref: dereferencer(state.serverState),
    };
  } else {
    return {
      album: undefined,
      parent: ownProps.parent.deref(state.serverState),
      deref: dereferencer(state.serverState),
    };
  }
}

const mapDispatchToProps = {
  albumCreated: actions.albumCreated,
  albumEdited: actions.albumEdited,
};

interface AlbumOverlayState {
  disabled: boolean;
  error?: AppError;
  inputs: InputFields;
}

type AlbumOverlayProps = ComponentProps<
  PassedProps,
  typeof mapStateToProps,
  typeof mapDispatchToProps
>;
class AlbumOverlay extends PureComponent<AlbumOverlayProps, AlbumOverlayState> {
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

  private onSubmit: (() => Promise<void>) = async (): Promise<void> => {
    let { name } = this.inputs;
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
        let data: Create<AlbumState> = {
          catalog: catalog.ref(),
          name,
          parent: album?.ref() ?? null,
        };

        let albumData = await createAlbum(data);
        this.props.albumCreated(albumData);
      } else {
        let album = parent instanceof Catalog ? null : parent;
        let updated: Patch<AlbumState> = {
          name,
          id: this.props.album.ref(),
          parent: album?.ref() ?? null,
        };
        let albumData = await editAlbum(updated);
        this.props.albumEdited(albumData);
      }
    } catch (e) {
      this.setState({ disabled: false, error: e });
    }
  };

  public renderSidebar(): ReactNode {
    let title = this.props.album ? "album-edit-sidebar" : "album-create-sidebar";

    return <Fragment>
      <div className="sidebar-item">
        <Localized id={title}><label className="title"/></Localized>
      </div>
      <MediaTargetSelector property={makeProperty(this.inputs, "parent")}/>
    </Fragment>;
  }

  public render(): ReactNode {
    let title = this.props.album ? "album-edit-title" : "album-create-title";

    return <Overlay title={title} error={this.state.error} sidebar={this.renderSidebar()}>
      <Form
        orientation="column"
        disabled={this.state.disabled}
        onSubmit={this.onSubmit}
        submit={this.props.album ? "album-edit-submit" : "album-create-submit"}
      >
        <FormField
          id="album-overlay-name"
          type="text"
          labelL10n="album-name"
          iconName="folder"
          required={true}
          property={makeProperty(this.inputs, "name")}
          disabled={this.state.disabled}
        />
      </Form>
    </Overlay>;
  }
}

export default connect<PassedProps>()(AlbumOverlay, mapStateToProps, mapDispatchToProps);
