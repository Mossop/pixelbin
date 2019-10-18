import React from "react";
import { connect } from "react-redux";

import { StoreState } from "../store/types";
import { Catalog } from "../api/types";
import { UIManager } from "../utils/UIState";
import Form, { FormProps, Field } from "../content/Form";
import { getStorageConfigUI, getStorageConfig } from "../storage";
import { createCatalog, editCatalog } from "../api/catalog";
import { catalogCreated, catalogEdited, DispatchProps } from "../store/actions";

interface StateProps {
  isFirst: boolean;
}

interface CatalogState {
  disabled: boolean;
  error: boolean;
}

interface PassedProps {
  catalog?: Catalog;
}

function mapStateToProps(state: StoreState): StateProps {
  return {
    isFirst: state.serverState.user ? !state.serverState.user.hadCatalog : true,
  };
}

const mapDispatchToProps = {
  catalogCreated,
  catalogEdited,
};

type CatalogProps = PassedProps & StateProps & DispatchProps<typeof mapDispatchToProps>;

class CatalogOverlay extends UIManager<CatalogProps, CatalogState> {
  public constructor(props: CatalogProps) {
    super(props);

    this.state = {
      disabled: false,
      error: false,
    };

    if (!props.catalog) {
      this.setTextState("storage", "backblaze");
    } else {
      this.setTextState("name", props.catalog.name);
    }
  }

  private onSubmit: (() => Promise<void>) = async(): Promise<void> => {
    let name = this.getTextState("name");
    if (!name) {
      return;
    }

    this.setState({ disabled: true });

    try {
      if (!this.props.catalog) {
        let storage = getStorageConfig(this.getTextState("storage"), this);
        let catalog = await createCatalog(name, storage);
        this.props.catalogCreated(catalog);
      } else {
        let catalog = await editCatalog(this.props.catalog, name);
        this.props.catalogEdited(catalog);
      }
    } catch (e) {
      this.setState({ disabled: false, error: true });
    }
  };

  private getStorageFields(): Field[] {
    if (!this.props.catalog) {
      let storageUI = getStorageConfigUI(this.getTextState("storage"));

      return [{
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
      }, ...storageUI];
    } else {
      return [];
    }
  }

  public renderUI(): React.ReactNode {
    let title = this.props.catalog ?
      "catalog-edit-title" :
      (this.props.isFirst ? "catalog-create-title-first" : "catalog-create-title");

    let form: FormProps = {
      disabled: this.state.disabled,
      onSubmit: this.onSubmit,
      className: this.state.error ? "error" : undefined,

      title,
      fields: [{
        fieldType: "textbox",
        uiPath: "name",
        labelL10n: "catalog-name",
        required: true,
      },
      ...this.getStorageFields()],
      submit: this.props.catalog ? "catalog-edit-submit" : "catalog-create-submit",
    };

    return <Form {...form}/>;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(CatalogOverlay);
