import React from "react";
import { connect } from "react-redux";

import { User, APIError } from "../api/types";
import Form, { FormField } from "../components/Form";
import { renderStorageConfigUI } from "../storage";
import { createCatalog } from "../api/catalog";
import { catalogCreated, DispatchProps } from "../store/actions";
import Overlay from "../components/overlay";
import { StorageConfig } from "../storage/types";
import { proxyReactState, makeProperty, Proxyable, proxy } from "../utils/StateProxy";
import { focus } from "../utils/helpers";

type Inputs = Proxyable<{
  name: string;
  storage: StorageConfig;
}>;

interface CatalogState {
  disabled: boolean;
  error?: APIError;
  inputs: Inputs;
}

interface PassedProps {
  user: User;
}

const mapDispatchToProps = {
  catalogCreated,
};

type CatalogProps = PassedProps & DispatchProps<typeof mapDispatchToProps>;

class CatalogOverlay extends React.Component<CatalogProps, CatalogState> {
  private inputs: Inputs;

  public constructor(props: CatalogProps) {
    super(props);

    this.state = {
      disabled: false,
      inputs: {
        name: "",
        storage: proxy({
          type: "server",
        }),
      },
    };

    this.inputs = proxyReactState(this, "inputs");
  }

  public componentDidMount(): void {
    focus("catalog-overlay-name");
  }

  private onSubmit: (() => Promise<void>) = async(): Promise<void> => {
    let name = this.inputs.name;
    if (!name) {
      return;
    }

    this.setState({ disabled: true });

    try {
      let catalog = await createCatalog(name, this.inputs.storage);
      this.props.catalogCreated(catalog);
    } catch (e) {
      this.setState({ disabled: false, error: e });
    }
  };

  public render(): React.ReactNode {
    let title = this.props.user.hadCatalog ? "catalog-create-title" : "catalog-create-title-first";

    return <Overlay title={title} error={this.state.error}>
      <Form orientation="column" disabled={this.state.disabled} onSubmit={this.onSubmit} submit="catalog-create-submit">
        <FormField id="catalog-overlay-name" type="text" labelL10n="catalog-name" iconName="folder" disabled={this.state.disabled} required={true} property={makeProperty(this.inputs, "name")}/>
        {renderStorageConfigUI(this.inputs.storage, this.state.disabled)}
      </Form>
    </Overlay>;
  }
}

export default connect(undefined, mapDispatchToProps)(CatalogOverlay);
