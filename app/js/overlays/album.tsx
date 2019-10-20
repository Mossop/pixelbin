import React from "react";
import { connect } from "react-redux";

import { UIManager } from "../utils/UIState";
import Form, { FormProps } from "../content/Form";
import { Album, Catalog, User } from "../api/types";
import { DispatchProps, albumCreated, albumEdited } from "../store/actions";
import { editAlbum, createAlbum } from "../api/album";
import { getParent, getCatalogForAlbum } from "../store/store";
import { Overlay } from ".";
import { CatalogTreeSelector } from "../components/CatalogTree";
import { Localized } from "@fluent/react";

interface AlbumState {
  disabled: boolean;
  error: boolean;
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
      error: false,
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
    let parent = getParent(this.getTextState("parent"));
    if (!parent) {
      return;
    }

    let catalog: Catalog;
    let parentAlbum: Album | undefined;
    if ("albums" in parent) {
      catalog = parent;
      parentAlbum = undefined;
    } else {
      parentAlbum = parent;
      let check = getCatalogForAlbum(parent);
      if (!check) {
        return;
      }
      catalog = check;
    }

    this.setState({ disabled: true });

    try {
      if (!this.props.album) {
        let album = await createAlbum(catalog, name, parentAlbum);
        this.props.albumCreated(catalog, album);
      } else {
        let album = await editAlbum(this.props.album, catalog, name, parentAlbum);
        this.props.albumEdited(catalog, album);
      }
    } catch (e) {
      this.setState({ disabled: false, error: true });
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
      className: this.state.error ? "error" : undefined,

      fields: [{
        fieldType: "textbox",
        uiPath: "name",
        labelL10n: "album-name",
        required: true,
      }],
      submit: this.props.album ? "album-edit-submit" : "album-create-submit",
    };

    return <Overlay title={title} sidebar={this.renderSidebar()}>
      <Form {...form}/>
    </Overlay>;
  }
}

export default connect(undefined, mapDispatchToProps)(AlbumOverlay);
