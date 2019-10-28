import React from "react";

import { BackblazeConfig } from "./types";
import { FormField } from "../components/Form";
import { makeProperty } from "../utils/StateProxy";

export function renderBackblazeConfigUI(config: BackblazeConfig, disabled: boolean): React.ReactNode {
  return <React.Fragment>
    <FormField id="keyId" type="text" labelL10n="storage-backblaze-keyid" iconName="key" required={true} disabled={disabled} property={makeProperty(config, "keyId")}/>
    <FormField id="key" type="text" labelL10n="storage-backblaze-key" iconName="key" required={true} disabled={disabled} property={makeProperty(config, "key")}/>
    <FormField id="bucket" type="text" labelL10n="storage-backblaze-bucket" iconName="database" required={true} disabled={disabled} property={makeProperty(config, "bucket")}/>
    <FormField id="path" type="text" labelL10n="storage-backblaze-path" iconName="folder" disabled={disabled} property={makeProperty(config, "path")}/>
  </React.Fragment>;
}
