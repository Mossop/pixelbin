import Box from "@material-ui/core/Box";
import React from "react";

import type { CatalogCreateState } from ".";
import { StorageState } from "../../api/types";
import { SelectField, Option, TextField, RadioGroup, Radio } from "../../components/Forms";
import { ReadonlyMapOf } from "../../utils/maps";
import { nulledString, ObjectState } from "../../utils/state";
import { ReactResult } from "../../utils/types";

export interface StorageChoice {
  storageType: string;
  existingStorage: string;
  endpoint: string;
  publicUrl: string;
}

export interface StorageChooserProps {
  storage: ReadonlyMapOf<StorageState>;
  state: ObjectState<CatalogCreateState>;
}

export default function StorageChooser({
  storage,
  state,
}: StorageChooserProps): ReactResult {
  return <RadioGroup name="storageType" state={state.storageType}>
    {
      storage.size > 0 && <React.Fragment>
        <Radio id="storage-type-existing" labelId="storage-type-existing" value="existing"/>
        <Box pl={3}>
          <SelectField
            id="catalog-existingStorage"
            disabled={state.storageType.value != "existing"}
            state={state.existingStorage}
            labelId="storage-existing"
          >
            {
              Array.from(storage.values(), (storage: StorageState) => <Option
                key={storage.id}
                value={storage.id}
              >
                {storage.name}
              </Option>)
            }
          </SelectField>
        </Box>
      </React.Fragment>
    }
    <Radio id="storage-type-aws" labelId="storage-type-aws" value="aws"/>
    <Radio id="storage-type-compatible" labelId="storage-type-compatible" value="compatible"/>
    <Box pl={3}>
      <TextField
        id="storage-endpoint"
        disabled={state.storageType.value != "compatible"}
        state={nulledString(state.storageConfig.endpoint)}
        type="url"
        autoComplete="url"
        labelId="storage-endpoint"
        required={state.storageType.value == "compatible"}
      />
      <TextField
        id="storage-public-url"
        disabled={state.storageType.value != "compatible"}
        state={nulledString(state.storageConfig.publicUrl)}
        type="url"
        autoComplete="url"
        labelId="storage-public-url"
      />
    </Box>
  </RadioGroup>;
}
