import React from "react";

import { Api } from "../../../model";
import { TextField } from "../../components/Forms";
import { nulledString, ObjectState } from "../../utils/state";
import { ReactRef, ReactResult } from "../../utils/types";

export interface StorageConfigProps {
  storageType: string;
  state: ObjectState<Api.StorageCreateRequest>;
  storageNameRef: ReactRef;
}

export default function StorageConfig({
  storageType,
  state,
  storageNameRef,
}: StorageConfigProps): ReactResult {
  return <React.Fragment>
    <TextField
      id="storage-name"
      ref={storageNameRef}
      labelId="storage-name"
      required={storageType != "existing"}
      state={state.name}
    />
    <TextField
      id="storage-access-key"
      labelId="storage-access-key"
      required={storageType != "existing"}
      state={state.accessKeyId}
    />
    <TextField
      id="storage-secret-key"
      labelId="storage-secret-key"
      required={storageType != "existing"}
      state={state.secretAccessKey}
    />
    <TextField
      id="storage-bucket"
      labelId="storage-bucket"
      required={storageType != "existing"}
      state={state.bucket}
    />
    <TextField
      id="storage-region"
      labelId="storage-region"
      required={storageType != "existing"}
      state={state.region}
    />
    <TextField
      id="storage-path"
      labelId="storage-path"
      required={storageType != "existing"}
      state={nulledString(state.path)}
    />
  </React.Fragment>;
}
