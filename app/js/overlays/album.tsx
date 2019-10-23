import React from "react";
import { connect } from "react-redux";

import { UIManager } from "../utils/UIState";
import Form, { FormProps } from "../components/Form";
import { Album, Catalog, User, APIError } from "../api/types";
import { DispatchProps, albumCreated, albumEdited } from "../store/actions";
import { editAlbum, createAlbum } from "../api/album";
import { getAlbum } from "../store/store";
import Overlay from "../components/overlay";
import { CatalogTreeSelector } from "../components/CatalogTree";
import { Localized } from "@fluent/react";
import { Patch } from "../api/api";

interface AlbumState {
  disabled: boolean;
  error?: APIError;
}

interface PassedProps {
  user: User;
  album?: Album;
  parent?: Catalog | Album;
}

const mapDispatchToProps = {
  albumCreated,
  albumEdited,
};

type AlbumProps = PassedProps & DispatchProps<typeof mapDispatchToProps>;

class AlbumOverlay extends UIManager<AlbumProps, AlbumState> {
  public constructor(props: AlbumProps) {
    super(props);

    this.state = {
      disabled: false,
    };

    if (this.props.parent) {
      this.setTextState("parent", this.props.parent.id);
    } else if (this.props.album) {
      this.setTextState("parent", this.props.album.parent || "");
      this.setTextState("name", this.props.album.name);
    } else {
      console.error("Invalid overlay state.");
    }
  }

  private onSubmit: (() => Promise<void>) = async(): Promise<void> => {
    let name = this.getTextState("name");
    if (!name) {
      return;
    }
    let parent = getAlbum(this.getTextState("parent"));
    if (!parent) {
      return;
    }

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
      <CatalogTreeSelector uiPath="parent"/>
    </React.Fragment>;
  }

  public renderUI(): React.ReactNode {
    let title = this.props.album ? "album-edit-title" : "album-create-title";

    let form: FormProps = {
      disabled: this.state.disabled,
      onSubmit: this.onSubmit,

      fields: [{
        fieldType: "textbox",
        uiPath: "name",
        labelL10n: "album-name",
        required: true,
      }],
      submit: this.props.album ? "album-edit-submit" : "album-create-submit",
    };

    return <Overlay title={title} error={this.state.error} sidebar={this.renderSidebar()}>
      <Form {...form}/>
    </Overlay>;
  }
}

export default connect(undefined, mapDispatchToProps)(AlbumOverlay);
