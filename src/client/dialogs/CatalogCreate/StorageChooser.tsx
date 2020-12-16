import Box from "@material-ui/core/Box";

import type { CatalogCreateState } from ".";
import type { StorageState } from "../../api/types";
import { SelectField, Option, TextField, RadioGroup, Radio } from "../../components/Forms";
import type { ReadonlyMapOf } from "../../utils/maps";
import type { ObjectState } from "../../utils/state";
import { nulledString } from "../../utils/state";
import type { ReactResult } from "../../utils/types";

export interface StorageChooserProps {
  visible: boolean;
  storage: ReadonlyMapOf<StorageState>;
  state: ObjectState<CatalogCreateState>;
}

export default function StorageChooser({
  storage,
  state,
}: StorageChooserProps): ReactResult {
  return <RadioGroup name="storageType" state={state.storageType}>
    {
      storage.size > 0 && <>
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
      </>
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
