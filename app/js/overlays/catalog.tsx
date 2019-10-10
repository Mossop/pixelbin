import React from "react";
import { connect } from "react-redux";

import { Overlay, OverlayType, StoreState } from "../types";
import { UIManager } from "../utils/uicontext";
import TextField from "../components/TextField";
import Selectbox from "../components/Selectbox";
import { getStorageConfigUI, StorageConfigUI } from "../storage";
import { createCatalog } from "../api/catalog";
import { catalogCreated, DispatchProps } from "../utils/actions";

export function isCreateCatalogOverlay(state: Overlay): boolean {
  return state.type === OverlayType.CreateCatalog;
}

interface CreateCatalogProps {
  isFirst: boolean;
}

interface CreateCatalogState {
  disabled: boolean;
  failed: boolean;
}

function mapStateToProps(state: StoreState): CreateCatalogProps {
  return {
    isFirst: state.serverState.user ? !state.serverState.user.hadCatalog : true,
  };
}

const mapDispatchToProps = {
  catalogCreated: catalogCreated,
};

class CreateCatalogOverlay extends UIManager<CreateCatalogProps & DispatchProps<typeof mapDispatchToProps>, CreateCatalogState> {
  private nameBox: React.RefObject<TextField>;
  private storageConfigUI: React.RefObject<StorageConfigUI>;

  public constructor(props: CreateCatalogProps & DispatchProps<typeof mapDispatchToProps>) {
    super(props);

    this.state = {
      disabled: false,
      failed: false,
    };
    this.nameBox = React.createRef();
    this.storageConfigUI = React.createRef();
  }

  public componentDidMount(): void {
    if (this.nameBox.current) {
      this.nameBox.current.focus();
    }
  }

  private onSubmit: ((event: React.FormEvent<HTMLFormElement>) => Promise<void>) = async(event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!this.storageConfigUI.current) {
      return;
    }

    let name = this.getTextState("name");
    if (!name) {
      return;
    }

    let storage = this.storageConfigUI.current.getStorageConfig();

    this.setState({ disabled: true });

    try {
      let catalog = await createCatalog(name, storage);
      this.props.catalogCreated(catalog);
    } catch (e) {
      this.setState({ disabled: false, failed: true });

      this.setTextState("email", "");
      this.setTextState("password", "");
    }
  };


  public renderUI(): React.ReactNode {
    let title = this.props.isFirst ? "Create your first catalog:" : "Create a new catalog:";
    let StorageUI = getStorageConfigUI(this.getTextState("storage"));
    return <div className="centerblock">
      <form id="catalogForm" className="fieldGrid" onSubmit={this.onSubmit}>
        <p className="formTitle">{title}</p>
        <TextField uiPath="name" ref={this.nameBox} required={true} disabled={this.state.disabled}>Catalog name:</TextField>
        <p className="fieldLabel"><label htmlFor="storage">Storage type:</label></p>
        <Selectbox id="storage" uiPath="storage">
          <option value="backblaze">Backblaze</option>
        </Selectbox>
        <StorageUI ref={this.storageConfigUI} disabled={this.state.disabled}/>
        <p className="spanEnd"><input type="submit" value="Create" disabled={this.state.disabled}/></p>
      </form>
    </div>;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(CreateCatalogOverlay);
