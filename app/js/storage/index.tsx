import React, { Fragment, PureComponent, ReactNode } from "react";

import { BackblazeStorageData, ServerStorageData } from "../api";
import { FormField } from "../components/Form";
import { Option } from "../components/Selectbox";
import { ComponentProps } from "../utils/component";
import { makeProperty, Property } from "../utils/StateProxy";
import { renderBackblazeConfigUI } from "./backblaze";

export type StorageData = BackblazeStorageData | ServerStorageData;

interface StorageTypeFieldPassedProps {
  property: Property<"server" | "backblaze">;
  disabled: boolean;
}

class StorageTypeField extends PureComponent<ComponentProps<StorageTypeFieldPassedProps>> {
  public render(): ReactNode {
    return <FormField
      id="storage-config-type"
      type="select"
      labelL10n="catalog-create-storage"
      iconName="server"
      disabled={this.props.disabled}
      property={this.props.property as Property<string>}
    >
      <Option l10n="storage-server-name" value="server"/>
      <Option l10n="storage-backblaze-name" value="backblaze"/>
    </FormField>;
  }
}

export function renderStorageConfigUI(config: StorageData, disabled: boolean): ReactNode {
  let inner: ReactNode = null;
  if (config.type === "backblaze") {
    inner = renderBackblazeConfigUI(config, disabled);
  }

  return <Fragment>
    <StorageTypeField disabled={disabled} property={makeProperty(config, "type")}/>
    {inner}
  </Fragment>;
}
