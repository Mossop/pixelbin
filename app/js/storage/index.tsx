import React from "react";

import { FormField } from "../components/Form";
import { StorageConfig } from "./types";
import { renderBackblazeConfigUI } from "./backblaze";
import { Option } from "../components/SelectBox";
import { makeProperty } from "../utils/StateProxy";

export function renderStorageConfigUI(config: StorageConfig, disabled: boolean): React.ReactNode {
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
