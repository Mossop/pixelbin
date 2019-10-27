import React from "react";
import { connect } from "react-redux";

import { User, APIError } from "../api/types";
import { UIManager } from "../utils/UIState";
import Form, { FormProps, Field } from "../components/Form";
import { getStorageConfigUI, getStorageConfig } from "../storage";
import { createCatalog } from "../api/catalog";
import { catalogCreated, DispatchProps } from "../store/actions";
import Overlay from "../components/overlay";

interface CatalogState {
  disabled: boolean;
  error?: APIError;
}

interface PassedProps {
  user: User;
}

const mapDispatchToProps = {
  catalogCreated,
};

type CatalogProps = PassedProps & DispatchProps<typeof mapDispatchToProps>;

class CatalogOverlay extends UIManager<CatalogProps, CatalogState> {
  public constructor(props: CatalogProps) {
    super(props);

    this.state = {
      disabled: false,
    };

    this.setTextState("storage", "backblaze");
  }

  private onSubmit: (() => Promise<void>) = async(): Promise<void> => {
    let name = this.getTextState("name");
    if (!name) {
      return;
    }

    this.setState({ disabled: true });

    try {
      let storage = getStorageConfig(this.getTextState("storage"), this);
      let catalog = await createCatalog(name, storage);
      this.props.catalogCreated(catalog);
    } catch (e) {
      this.setState({ disabled: false, error: e });
    }
  };

  private getStorageFields(): Field[] {
    let storageUI = getStorageConfigUI(this.getTextState("storage"));

    return [{
      fieldType: "selectbox",
      uiPath: "storage",
      labelL10n: "catalog-create-storage",
      iconName: "server",
      choices: [{
        value: "backblaze",
        l10n: "storage-backblaze-name",
      }, {
        value: "server",
        l10n: "storage-server-name",
      }]
    }, ...storageUI];
  }

  public renderUI(): React.ReactNode {
    let title = this.props.user.hadCatalog ? "catalog-create-title" : "catalog-create-title-first";

    let form: FormProps = {
      orientation: "column",
      disabled: this.state.disabled,
      onSubmit: this.onSubmit,

      fields: [{
        fieldType: "textbox",
        uiPath: "name",
        labelL10n: "catalog-name",
        iconName: "folder",
        required: true,
      },
      ...this.getStorageFields()],
      submit: "catalog-create-submit",
    };

    return <Overlay title={title} error={this.state.error}>
      <Form {...form}/>
    </Overlay>;
  }
}

export default connect(undefined, mapDispatchToProps)(CatalogOverlay);
