import React from "react";
import { Localized } from "@fluent/react";

import Form, { FormField } from "../components/Form";
import { UserData, APIError, AlbumData, CreateData } from "../api/types";
import { albumCreated, albumEdited } from "../store/actions";
import { editAlbum, createAlbum } from "../api/album";
import Overlay from "../components/Overlay";
import { CatalogTreeSelector } from "../components/CatalogTree";
import { Patch } from "../api/api";
import { proxyReactState, makeProperty } from "../utils/StateProxy";
import { focus } from "../utils/helpers";
import { Album } from "../api/highlevel";
import { ComponentProps, connect } from "../components/shared";
import { Immutable } from "../utils/immer";
import { StoreState } from "../store/types";
import { exception, ErrorCode } from "../utils/exception";

interface InputFields {
  name: string;
  parent: Album | undefined;
}

interface PassedProps {
  user: Immutable<UserData>;
  album?: string;
  parent?: string;
}

interface FromStateProps {
  album?: Album;
  parent?: Album;
}

function mapStateToProps(state: StoreState, ownProps: PassedProps): FromStateProps {
  if (ownProps.album) {
    let album = Album.fromState(state, ownProps.album);
    return {
      album,
      parent: album.parent,
    };
  }

  if (ownProps.parent) {
    return {
      parent: Album.fromState(state, ownProps.parent),
    };
  }

  exception(ErrorCode.InvalidState);
}

const mapDispatchToProps = {
  albumCreated,
  albumEdited,
};

interface AlbumOverlayState {
  disabled: boolean;
  error?: APIError;
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
        parent: this.props.parent,
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
    let parent = this.inputs.parent;
    if (!parent) {
      exception(ErrorCode.InvalidState);
    }

    this.setState({ disabled: true });

    try {
      if (!this.props.album) {
        let data: CreateData<AlbumData> = {
          catalog: parent.catalog.id,
          name,
          parent: parent.id,
        };

        let album = await createAlbum(data);
        this.props.albumCreated(album);
      } else {
        let updated: Patch<AlbumData> = {
          name,
          id: this.props.album.id,
          parent: parent.id,
        };
        let album = await editAlbum(updated);
        this.props.albumEdited(album);
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
      <CatalogTreeSelector property={makeProperty(this.inputs, "parent")}/>
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

export default connect<PassedProps>(mapStateToProps, mapDispatchToProps)(AlbumOverlay);
