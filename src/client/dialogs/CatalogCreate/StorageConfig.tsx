import React, { useRef, useEffect } from "react";

import type { Requests } from "../../../model";
import { TextField } from "../../components/Forms";
import type { ObjectState } from "../../utils/state";
import { nulledString } from "../../utils/state";
import type { ReactResult } from "../../utils/types";

export interface StorageConfigProps {
  visible: boolean;
  storageType: string;
  state: ObjectState<Requests.StorageCreate>;
}

export default function StorageConfig({
  visible,
  storageType,
  state,
}: StorageConfigProps): ReactResult {
  let nameRef = useRef<HTMLElement>();

  useEffect(() => {
    if (visible) {
      nameRef.current?.focus();
    }
  }, [nameRef, visible]);

  return <React.Fragment>
    <TextField
      id="storage-name"
      ref={nameRef}
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
      state={nulledString(state.path)}
    />
  </React.Fragment>;
}
