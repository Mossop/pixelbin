import React from "react";

import { BackblazeConfig } from "./types";
import { FormField } from "../components/Form";
import { InputGroup } from "../utils/InputState";

export function renderBackblazeConfigUI(group: InputGroup<BackblazeConfig>, disabled: boolean): React.ReactNode {
  return <React.Fragment>
    <FormField id="keyId" type="text" labelL10n="storage-backblaze-keyid" iconName="key" required={true} disabled={disabled} inputs={group.getInputState("keyId")}/>
    <FormField id="key" type="text" labelL10n="storage-backblaze-key" iconName="key" required={true} disabled={disabled} inputs={group.getInputState("key")}/>
    <FormField id="bucket" type="text" labelL10n="storage-backblaze-bucket" iconName="database" required={true} disabled={disabled} inputs={group.getInputState("bucket")}/>
    <FormField id="path" type="text" labelL10n="storage-backblaze-path" iconName="folder" disabled={disabled} inputs={group.getInputState("path")}/>
  </React.Fragment>;
}
