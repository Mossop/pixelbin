import React from "react";
import { connect } from "react-redux";

import { Overlay, OverlayType, StoreState } from "../types";
import { UIManager } from "../utils/UIState";
import Form, { FormProps } from "../content/Form";
import { getStorageConfigUI, getStorageConfig } from "../storage";
import { createCatalog } from "../api/catalog";
import { catalogCreated, DispatchProps } from "../utils/actions";

export function isCreateCatalogOverlay(state: Overlay): boolean {
  return state.type === OverlayType.CreateCatalog;
}

interface StateProps {
  isFirst: boolean;
}

interface CreateCatalogState {
  disabled: boolean;
  error: boolean;
}

function mapStateToProps(state: StoreState): StateProps {
  return {
    isFirst: state.serverState.user ? !state.serverState.user.hadCatalog : true,
  };
}

const mapDispatchToProps = {
  catalogCreated: catalogCreated,
};

class CreateCatalogOverlay extends UIManager<StateProps & DispatchProps<typeof mapDispatchToProps>, CreateCatalogState> {
  public constructor(props: StateProps & DispatchProps<typeof mapDispatchToProps>) {
    super(props);

    this.state = {
      disabled: false,
      error: false,
    };

    this.setTextState("storage", "backblaze");
  }

  private onSubmit: (() => Promise<void>) = async(): Promise<void> => {
    let name = this.getTextState("name");
    if (!name) {
      return;
    }

    let storage = getStorageConfig(this.getTextState("storage"), this);

    this.setState({ disabled: true });

    try {
      let catalog = await createCatalog(name, storage);
      this.props.catalogCreated(catalog);
    } catch (e) {
      this.setState({ disabled: false, error: true });
    }
  };

  public renderUI(): React.ReactNode {
    let title = this.props.isFirst ? "catalog-create-title-first" : "catalog-create-title";
    let storageUI = getStorageConfigUI(this.getTextState("storage"));

    let form: FormProps = {
      disabled: this.state.disabled,
      onSubmit: this.onSubmit,
      className: this.state.error ? "error" : undefined,

      title,
      fields: [{
        fieldType: "textbox",
        uiPath: "name",
        labelL10n: "catalog-create-name",
        required: true,
      }, {
        fieldType: "selectbox",
        uiPath: "storage",
        labelL10n: "catalog-create-storage",
        choices: [{
          value: "backblaze",
          l10n: "storage-backblaze-name",
        }, {
          value: "server",
          l10n: "storage-server-name",
        }]
      }, ...storageUI],
      submit: "catalog-create-submit",
    };

    return <Form {...form}/>;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(CreateCatalogOverlay);
