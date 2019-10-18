import React from "react";
import { connect } from "react-redux";

import { UIManager } from "../utils/UIState";
import Form, { FormProps } from "../content/Form";
import { Album, Catalog } from "../api/types";
import { DispatchProps } from "../store/actions";

interface AlbumState {
  disabled: boolean;
  error: boolean;
}

interface PassedProps {
  catalog: Catalog;
  parent?: Album;
  album?: Album;
}

const mapDispatchToProps = {
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
    let name = await Promise.resolve(this.getTextState("name"));
    if (!name) {
      return;
    }

    this.setState({ disabled: true });

    try {
      // TODO
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
