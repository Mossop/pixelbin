import React from "react";
import { connect } from "react-redux";

import { Overlay, OverlayType, StoreState } from "../types";
import { UIProvider } from "../utils/uicontext";
import Textbox from "../components/textbox";

export function isCreateCatalogOverlay(state: Overlay): boolean {
  return state.type === OverlayType.CreateCatalog;
}

interface CreateCatalogProps {
  isFirst: boolean;
}

interface CreateCatalogState {
  disabled: boolean;
}

function mapStateToProps(state: StoreState): CreateCatalogProps {
  return {
    isFirst: state.serverState.user ? !state.serverState.user.hadCatalog : true,
  };
}

class CreateCatalogOverlay extends React.Component<CreateCatalogProps, CreateCatalogState> {
  private nameBox: React.RefObject<Textbox>;

  public constructor(props: CreateCatalogProps) {
    super(props);

    this.state = {
      disabled: false,
    };
    this.nameBox = React.createRef();
  }

  private onSubmit: ((event: React.FormEvent<HTMLFormElement>) => Promise<void>) = async(event: React.FormEvent<HTMLFormElement>): Promise<void> => {
  };

  public render(): React.ReactNode {
    let title = this.props.isFirst ? "Create your first catalog:" : "Create a new catalog:";
    return <UIProvider>
      <div className="centerblock">
        <form id="catalogForm" className="fieldGrid" onSubmit={this.onSubmit}>
          <p style={{ paddingBottom: "15px", gridColumn: "span 2", justifySelf: "start" }}>{title}</p>
          <p className="rightAlign"><label htmlFor="name">Catalog name:</label></p>
          <Textbox type="text" id="name" ref={this.nameBox} uiPath="name"/>
          <p style={{ gridColumn: "span 2", justifySelf: "end" }}><input id="" type="submit" value="Create" disabled={this.state.disabled}/></p>
        </form>
      </div>
    </UIProvider>;
  }
}

export default connect(mapStateToProps)(CreateCatalogOverlay);
