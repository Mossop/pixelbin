import React from "react";

import FormFields from "../../components/FormFields";
import { FormStateSetter } from "../../utils/hooks";
import { ReactRef, ReactResult } from "../../utils/types";
import { StorageChoice } from "./StorageChooser";

export interface StorageState {
  storageName: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  path: string;
}

export interface StorageConfigProps {
  disabled: boolean;
  storageChoice: StorageChoice;
  storageConfig: StorageState;
  setStorageConfig: FormStateSetter<StorageState>;
  storageNameRef: ReactRef;
}

export default function StorageConfig({
  disabled,
  storageChoice,
  storageConfig,
  setStorageConfig,
  storageNameRef,
}: StorageConfigProps): ReactResult {
  return <FormFields
    id="stepped-dialog"
    state={storageConfig}
    setState={setStorageConfig}
    disabled={disabled}
    fields={
      [{
        type: "text",
        ref: storageNameRef,
        key: "storageName",
        label: "storage-name",
        required: storageChoice.storageType != "existing",
      }, {
        type: "text",
        key: "accessKeyId",
        label: "storage-access-key",
        required: storageChoice.storageType != "existing",
      }, {
        type: "text",
        key: "secretAccessKey",
        label: "storage-secret-key",
        required: storageChoice.storageType != "existing",
      }, {
        type: "text",
        key: "bucket",
        required: storageChoice.storageType != "existing",
        label: "storage-bucket",
      }, {
        type: "text",
        key: "region",
        required: storageChoice.storageType != "existing",
        label: "storage-region",
      }, {
        type: "text",
        key: "path",
        label: "storage-path",
      }]
    }
  />;
}
