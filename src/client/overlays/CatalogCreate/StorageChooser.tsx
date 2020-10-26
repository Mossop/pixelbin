import Box from "@material-ui/core/Box";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Radio from "@material-ui/core/Radio";
import React from "react";

import { StorageState } from "../../api/types";
import FormFields, { Option } from "../../components/FormFields";
import { FormStateSetter } from "../../utils/hooks";
import { ReadonlyMapOf } from "../../utils/maps";
import { ReactResult } from "../../utils/types";

export interface StorageChoice {
  storageType: string;
  existingStorage: string;
  endpoint: string;
  publicUrl: string;
}

export interface StorageChooserProps {
  disabled: boolean;
  storage: ReadonlyMapOf<StorageState>;
  storageChoice: StorageChoice;
  setStorageChoice: FormStateSetter<StorageChoice>;
  onStorageTypeChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function StorageChooser({
  disabled,
  storage,
  storageChoice,
  setStorageChoice,
  onStorageTypeChange,
}: StorageChooserProps): ReactResult {
  return <React.Fragment>
    {
      storage.size > 0 && <React.Fragment>
        <FormControlLabel
          disabled={disabled}
          label="Existing storage"
          control={
            <Radio
              id="storage-existing"
              checked={storageChoice.storageType == "existing"}
              name="storageType"
              value="existing"
              onChange={onStorageTypeChange}
            />
          }
        />
        <Box pl={3}>
          <FormFields
            id="stepped-dialog"
            disabled={disabled || storageChoice.storageType != "existing"}
            state={storageChoice}
            setState={setStorageChoice}
            fields={
              [{
                type: "select",
                key: "existingStorage",
                label: "storage-existing",
                options: Array.from(
                  storage.values(),
                  (storage: StorageState): Option => {
                    return {
                      value: storage.id,
                      label: storage.name,
                    };
                  },
                ),
              }]
            }
          />
        </Box>
      </React.Fragment>
    }
    <FormControlLabel
      disabled={disabled}
      label="AWS S3 bucket"
      control={
        <Radio
          id="storage-aws"
          checked={storageChoice.storageType == "aws"}
          name="storageType"
          value="aws"
          onChange={onStorageTypeChange}
        />
      }
    />
    <FormControlLabel
      disabled={disabled}
      label="S3 compatible bucket"
      control={
        <Radio
          id="storage-compatible"
          checked={storageChoice.storageType == "compatible"}
          name="storageType"
          value="compatible"
          onChange={onStorageTypeChange}
        />
      }
    />
    <Box pl={3}>
      <FormFields
        id="stepped-dialog"
        disabled={disabled || storageChoice.storageType != "compatible"}
        state={storageChoice}
        setState={setStorageChoice}
        fields={
          [{
            type: "text",
            key: "endpoint",
            label: "storage-endpoint",
            inputType: "url",
            required: storageChoice.storageType == "compatible",
          }, {
            type: "text",
            key: "publicUrl",
            label: "storage-public-url",
            inputType: "url",
          }]
        }
      />
    </Box>
  </React.Fragment>;
}
