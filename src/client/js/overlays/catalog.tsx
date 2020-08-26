import React, { ReactNode, PureComponent } from "react";

import { Obj } from "../../../utils";
import { createCatalog } from "../api/catalog";
import { UserState } from "../api/types";
import Form, { FormField } from "../components/Form";
import Overlay from "../components/Overlay";
import actions from "../store/actions";
import { connect, ComponentProps } from "../utils/component";
import { AppError } from "../utils/exception";
import { focus } from "../utils/helpers";
import { proxyReactState, makeProperty } from "../utils/StateProxy";

interface InputFields {
  catalogName: string;
  storageName: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  path: string;
  endpoint: string;
  publicUrl: string;
}

interface PassedProps {
  user: UserState;
}

const mapDispatchToProps = {
  catalogCreated: actions.catalogCreated,
};

interface CatalogOverlayState {
  disabled: boolean;
  inputs: InputFields;
  error?: AppError;
}

type CatalogOverlayProps = ComponentProps<PassedProps, Obj, typeof mapDispatchToProps>;
class CatalogOverlay extends PureComponent<CatalogOverlayProps, CatalogOverlayState> {
  private inputs: InputFields;

  public constructor(props: CatalogOverlayProps) {
    super(props);

    this.state = {
      disabled: false,
      // eslint-disable-next-line react/no-unused-state
      inputs: {
        catalogName: "",
        storageName: "",
        accessKeyId: "",
        secretAccessKey: "",
        region: "",
        bucket: "",
        path: "",
        endpoint: "",
        publicUrl: "",
      },
    };

    this.inputs = proxyReactState(this, "inputs");
  }

  public componentDidMount(): void {
    focus("catalog-overlay-name");
  }

  private onSubmit: (() => Promise<void>) = async (): Promise<void> => {
    let { catalogName, storageName, ...storageFields } = this.inputs;
    if (!catalogName || !storageName || !storageFields.accessKeyId ||
      !storageFields.secretAccessKey || !storageFields.region || !storageFields.bucket) {
      return;
    }

    let storage = {
      name: storageName,
      accessKeyId: storageFields.accessKeyId,
      secretAccessKey: storageFields.secretAccessKey,
      region: storageFields.region,
      bucket: storageFields.bucket,
      path: storageFields.path ? storageFields.path : null,
      endpoint: storageFields.endpoint ? storageFields.endpoint : null,
      publicUrl: storageFields.publicUrl ? storageFields.publicUrl : null,
    };

    this.setState({ disabled: true, error: undefined });

    try {
      let catalog = await createCatalog(catalogName, storage);
      this.props.catalogCreated(catalog);
    } catch (e) {
      this.setState({ disabled: false, error: e });
    }
  };

  public render(): ReactNode {
    let title = this.props.user.hadCatalog ? "catalog-create-title" : "catalog-create-title-first";

    return <Overlay title={title} error={this.state.error}>
      <Form
        orientation="column"
        disabled={this.state.disabled}
        onSubmit={this.onSubmit}
        submit="catalog-create-submit"
      >
        <FormField
          id="catalog-overlay-catalog-name"
          type="text"
          labelL10n="catalog-name"
          iconName="folder"
          disabled={this.state.disabled}
          required={true}
          property={makeProperty(this.inputs, "catalogName")}
        />
        <FormField
          id="catalog-overlay-storage-name"
          type="text"
          labelL10n="storage-name"
          iconName="folder"
          disabled={this.state.disabled}
          required={true}
          property={makeProperty(this.inputs, "storageName")}
        />
        <FormField
          id="catalog-overlay-storage-access-key"
          type="text"
          labelL10n="storage-access-key"
          iconName="folder"
          disabled={this.state.disabled}
          required={true}
          property={makeProperty(this.inputs, "accessKeyId")}
        />
        <FormField
          id="catalog-overlay-storage-secret-key"
          type="text"
          labelL10n="storage-secret-key"
          iconName="folder"
          disabled={this.state.disabled}
          required={true}
          property={makeProperty(this.inputs, "secretAccessKey")}
        />
        <FormField
          id="catalog-overlay-storage-region"
          type="text"
          labelL10n="storage-region"
          iconName="folder"
          disabled={this.state.disabled}
          required={true}
          property={makeProperty(this.inputs, "region")}
        />
        <FormField
          id="catalog-overlay-storage-bucket"
          type="text"
          labelL10n="storage-bucket"
          iconName="folder"
          disabled={this.state.disabled}
          required={true}
          property={makeProperty(this.inputs, "bucket")}
        />
        <FormField
          id="catalog-overlay-storage-path"
          type="text"
          labelL10n="storage-path"
          iconName="folder"
          disabled={this.state.disabled}
          required={false}
          property={makeProperty(this.inputs, "path")}
        />
        <FormField
          id="catalog-overlay-storage-endpoint"
          type="text"
          labelL10n="storage-endpoint"
          iconName="folder"
          disabled={this.state.disabled}
          required={false}
          property={makeProperty(this.inputs, "endpoint")}
        />
        <FormField
          id="catalog-overlay-storage-public-url"
          type="text"
          labelL10n="storage-public-url"
          iconName="folder"
          disabled={this.state.disabled}
          required={false}
          property={makeProperty(this.inputs, "publicUrl")}
        />
      </Form>
    </Overlay>;
  }
}

export default connect<PassedProps>()(CatalogOverlay, undefined, mapDispatchToProps);
