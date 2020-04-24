import React, { Fragment, ReactNode } from "react";

import { BackblazeStorageData } from "../api";
import { FormField } from "../components/Form";
import { makeProperty } from "../utils/StateProxy";

export function renderBackblazeConfigUI(
  config: BackblazeStorageData,
  disabled: boolean,
): ReactNode {
  return <Fragment>
    <FormField
      id="backblaze-config-keyId"
      type="text"
      labelL10n="storage-backblaze-keyid"
      iconName="key"
      required={true}
      disabled={disabled}
      property={makeProperty(config, "keyId")}
    />
    <FormField
      id="backblaze-config-key"
      type="text"
      labelL10n="storage-backblaze-key"
      iconName="key"
      required={true}
      disabled={disabled}
      property={makeProperty(config, "key")}
    />
    <FormField
      id="backblaze-config-bucket"
      type="text"
      labelL10n="storage-backblaze-bucket"
      iconName="database"
      required={true}
      disabled={disabled}
      property={makeProperty(config, "bucket")}
    />
    <FormField
      id="backblaze-config-path"
      type="text"
      labelL10n="storage-backblaze-path"
      iconName="folder"
      disabled={disabled}
      property={makeProperty(config, "path")}
    />
  </Fragment>;
}
