import React from "react";

import { FormField } from "../components/Form";
import { StorageConfig, BackblazeConfig } from "./types";
import { renderBackblazeConfigUI } from "./backblaze";
import { InputGroup } from "../utils/InputState";
import { Option } from "../components/SelectBox";

export function renderStorageConfigUI(group: InputGroup<StorageConfig>, disabled: boolean): React.ReactNode {
  let inner: React.ReactNode = null;
  if (group.castInto((state: StorageConfig): state is BackblazeConfig => state.type === "backblaze")) {
    inner = renderBackblazeConfigUI(group, disabled);
  }

  return <React.Fragment>
    <FormField id="storage" type="select" labelL10n="catalog-create-storage" iconName="server" disabled={disabled} inputs={group.getInputState("type")}>
      <Option l10n="storage-server-name" value="server"/>
      <Option l10n="storage-backblaze-name" value="backblaze"/>
    </FormField>
    {inner}
  </React.Fragment>;
}
