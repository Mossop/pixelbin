import { Immutable } from "immer";
import React from "react";

import { createCatalog } from "../api/catalog";
import { UserData } from "../api/types";
import Form, { FormField } from "../components/Form";
import Overlay from "../components/Overlay";
import { ComponentProps, connect } from "../components/shared";
import { renderStorageConfigUI, StorageData } from "../storage";
import { catalogCreated } from "../store/actions";
import { AppError } from "../utils/exception";
import { focus } from "../utils/helpers";
import { proxyReactState, makeProperty, Proxyable, proxy } from "../utils/StateProxy";

type InputFields = Proxyable<{
  name: string;
  storage: StorageData;
}>;

interface PassedProps {
  user: Immutable<UserData>;
}

const mapDispatchToProps = {
  catalogCreated,
};

type CatalogOverlayProps = ComponentProps<PassedProps, {}, typeof mapDispatchToProps>;

interface CatalogOverlayState {
  disabled: boolean;
  inputs: InputFields;
  error?: AppError;
}

class CatalogOverlay extends React.Component<CatalogOverlayProps, CatalogOverlayState> {
  private inputs: InputFields;

  public constructor(props: CatalogOverlayProps) {
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

    this.setState({ disabled: true, error: undefined });

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

export default connect<PassedProps>()(undefined, mapDispatchToProps)(CatalogOverlay);
