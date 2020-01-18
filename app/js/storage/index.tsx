import React from "react";

import { BackblazeStorageData, ServerStorageData } from "../api/types";
import { FormField } from "../components/Form";
import { Option } from "../components/Selectbox";
import { makeProperty } from "../utils/StateProxy";
import { renderBackblazeConfigUI } from "./backblaze";

export type StorageData = BackblazeStorageData | ServerStorageData;

export function renderStorageConfigUI(config: StorageData, disabled: boolean): React.ReactNode {
  let inner: React.ReactNode = null;
  if (config.type === "backblaze") {
    inner = renderBackblazeConfigUI(config, disabled);
  }

  return <React.Fragment>
    <FormField id="storage-config-type" type="select" labelL10n="catalog-create-storage" iconName="server" disabled={disabled} property={makeProperty(config, "type")}>
      <Option l10n="storage-server-name" value="server"/>
      <Option l10n="storage-backblaze-name" value="backblaze"/>
    </FormField>
    {inner}
  </React.Fragment>;
}
