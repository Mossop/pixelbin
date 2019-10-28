import React from "react";
import { connect } from "react-redux";

import Form, { FormField } from "../components/Form";
import { Album, User, APIError } from "../api/types";
import { DispatchProps, albumCreated, albumEdited } from "../store/actions";
import { editAlbum, createAlbum } from "../api/album";
import Overlay from "../components/overlay";
import { CatalogTreeSelector } from "../components/CatalogTree";
import { Localized } from "@fluent/react";
import { Patch } from "../api/api";
import { ReactInputs } from "../utils/InputState";

interface Inputs {
  name: string;
  parent: Album;
}

interface AlbumState {
  disabled: boolean;
  error?: APIError;
  inputs: Inputs;
}

interface PassedProps {
  user: User;
  album?: Album;
  parent: Album;
}

const mapDispatchToProps = {
  albumCreated,
  albumEdited,
};

type AlbumProps = PassedProps & DispatchProps<typeof mapDispatchToProps>;

class AlbumOverlay extends ReactInputs<Inputs, AlbumProps, AlbumState> {
  public constructor(props: AlbumProps) {
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
  }

  private onSubmit: (() => Promise<void>) = async(): Promise<void> => {
    let name = this.state.inputs.name;
    if (!name) {
      return;
    }
    let parent = this.state.inputs.parent;

    this.setState({ disabled: true });

    try {
      if (!this.props.album) {
        let album = await createAlbum(name, parent);
        this.props.albumCreated(album);
      } else {
        let updated: Patch<Album> = {
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
        <Localized id={title}><label/></Localized>
      </div>
      <CatalogTreeSelector inputs={this.getInputState("parent")}/>
    </React.Fragment>;
  }

  public render(): React.ReactNode {
    let title = this.props.album ? "album-edit-title" : "album-create-title";

    return <Overlay title={title} error={this.state.error} sidebar={this.renderSidebar()}>
      <Form orientation="column" disabled={this.state.disabled} onSubmit={this.onSubmit} submit={this.props.album ? "album-edit-submit" : "album-create-submit"}>
        <FormField id="name" type="text" labelL10n="album-name" iconName="folder" required={true} inputs={this.getInputState("name")}/>
      </Form>
    </Overlay>;
  }
}

export default connect(undefined, mapDispatchToProps)(AlbumOverlay);
