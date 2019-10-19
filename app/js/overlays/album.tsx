import React from "react";
import { connect } from "react-redux";

import { UIManager } from "../utils/UIState";
import Form, { FormProps } from "../content/Form";
import { Album, Catalog, User } from "../api/types";
import { DispatchProps, albumCreated, albumEdited } from "../store/actions";
import { editAlbum, createAlbum } from "../api/album";
import { getCatalog } from "../store/store";

interface AlbumState {
  disabled: boolean;
  error: boolean;
}

interface PassedProps {
  user: User;
  catalog: Catalog;
  parent?: Album;
  album?: Album;
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
      error: false,
    };

    this.setTextState("catalog", this.props.catalog.id);
    if (this.props.parent) {
      this.setTextState("parent", this.props.parent.id);
    }

    if (this.props.album) {
      this.setTextState("parent", this.props.album.parent || "");
      this.setTextState("name", this.props.album.name);
    }
  }

  private onSubmit: (() => Promise<void>) = async(): Promise<void> => {
    let name = this.getTextState("name");
    if (!name) {
      return;
    }
    let catalogId = this.getTextState("catalog");
    if (!catalogId) {
      return;
    }
    let catalog = getCatalog(catalogId);
    if (!catalog) {
      return;
    }
    let parent = this.getTextState("parent");

    this.setState({ disabled: true });

    try {
      if (!this.props.album) {
        let album = await createAlbum(catalog, name, parent);
        this.props.albumCreated(catalog, album);
      } else {
        let album = await editAlbum(this.props.album, catalog, name, parent);
        this.props.albumEdited(catalog, album);
      }
    } catch (e) {
      this.setState({ disabled: false, error: true });
    }
  };

  public renderUI(): React.ReactNode {
    let title = this.props.album ? "album-edit-title" : "album-create-title";

    let form: FormProps = {
      disabled: this.state.disabled,
      onSubmit: this.onSubmit,
      className: this.state.error ? "error" : undefined,

      title,
      fields: [{
        fieldType: "textbox",
        uiPath: "name",
        labelL10n: "album-name",
        required: true,
      }],
      submit: this.props.album ? "album-edit-submit" : "album-create-submit",
    };

    return <Form {...form}/>;
  }
}

export default connect(undefined, mapDispatchToProps)(AlbumOverlay);
