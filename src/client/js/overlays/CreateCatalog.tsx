import Box from "@material-ui/core/Box";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Radio from "@material-ui/core/Radio";
import React, { useCallback, useMemo, useState } from "react";

import { createCatalog, createStorage } from "../api/catalog";
import { StorageState, UserState } from "../api/types";
import FormFields, { Option } from "../components/FormFields";
import SteppedDialog, { Step } from "../components/SteppedDialog";
import { useActions } from "../store/actions";
import { AppError } from "../utils/exception";
import { useFormState } from "../utils/hooks";
import { ReactResult } from "../utils/types";

export interface CreateCatalogOverlayProps {
  user: UserState;
}

export default function CreateCatalogOverlay(props: CreateCatalogOverlayProps): ReactResult {
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const actions = useActions();
  const [currentStep, setCurrentStep] = useState(0);

  let [storageChoice, setStorageChoice] = useFormState({
    storageType: props.user.storage.size ? "existing" : "aws",
    existingStorage: props.user.storage.size ? [...props.user.storage.values()][0].id : "",
    endpoint: "",
    publicUrl: "",
  });

  let [customStorage, setCustomStorage] = useFormState({
    storageName: "",
    accessKeyId: "",
    secretAccessKey: "",
    region: "",
    bucket: "",
    path: "",
  });

  let [catalogState, setCatalogState] = useFormState({
    catalogName: "",
  });

  const onBack = useCallback(() => {
    let nextStep = currentStep - 1;
    if (nextStep == 1 && storageChoice.storageType == "existing") {
      nextStep--;
    }

    setCurrentStep(nextStep);
  }, [currentStep, storageChoice]);
  const onNext = useCallback(() => {
    let nextStep = currentStep + 1;
    if (nextStep == 1 && storageChoice.storageType == "existing") {
      nextStep++;
    }

    setCurrentStep(nextStep);
  }, [currentStep, storageChoice]);

  const onSubmit = useCallback(async (): Promise<void> => {
    setDisabled(true);
    setError(null);

    try {
      let storageId = storageChoice.existingStorage;

      if (storageChoice.storageType != "existing") {
        let storage = await createStorage({
          name: customStorage.storageName,
          accessKeyId: customStorage.accessKeyId,
          secretAccessKey: customStorage.secretAccessKey,
          region: customStorage.region,
          bucket: customStorage.bucket,
          path: customStorage.path ? customStorage.path : null,
          endpoint: storageChoice.endpoint ? storageChoice.endpoint : null,
          publicUrl: storageChoice.publicUrl ? storageChoice.publicUrl : null,
        });

        actions.storageCreated(storage);
        // In case the catalog creation fails for some odd reason configure to use
        // the new storage.
        setStorageChoice("existingStorage", storage.id);
        setStorageChoice("storageType", "existing");

        storageId = storage.id;
      }

      let catalog = await createCatalog(catalogState.catalogName, storageId);
      actions.catalogCreated(catalog);
    } catch (e) {
      setError(e);
    } finally {
      setDisabled(false);
    }
  }, [actions, customStorage, catalogState, storageChoice, setStorageChoice]);

  const onStorageTypeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    // @ts-ignore: We know this is correct.
    setStorageChoice("storageType", event.target.value);
  }, [setStorageChoice]);

  const isFilled = (val: string): boolean => val.length > 0;

  let canAdvance = useMemo((): boolean => {
    switch (currentStep) {
      case 0:
        return storageChoice.storageType != "compatible" || isFilled(storageChoice.endpoint);
      case 1:
        return isFilled(customStorage.storageName) && isFilled(customStorage.accessKeyId) &&
          isFilled(customStorage.secretAccessKey) && isFilled(customStorage.bucket);
      case 2:
        return isFilled(catalogState.catalogName);
    }

    return true;
  }, [currentStep, storageChoice, customStorage, catalogState]);

  const steps = [
    useMemo((): Step => {
      return {
        titleId: "create-catalog-storage-title",
        content: <React.Fragment>
          {
            props.user.storage.size > 0 && <React.Fragment>
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
                  disabled={disabled || storageChoice.storageType != "existing"}
                  state={storageChoice}
                  setState={setStorageChoice}
                  fields={
                    [{
                      type: "select",
                      key: "existingStorage",
                      label: "storage-existing",
                      options: Array.from(
                        props.user.storage.values(),
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
                  props: {
                    margin: "dense",
                    size: "small",
                  },
                }, {
                  type: "text",
                  key: "publicUrl",
                  label: "storage-public-url",
                  inputType: "url",
                  props: {
                    margin: "dense",
                    size: "small",
                  },
                }]
              }
            />
          </Box>
        </React.Fragment>,
      };
    }, [
      disabled,
      props.user.storage,
      onStorageTypeChange,
      storageChoice,
      setStorageChoice,
    ]),
    useMemo((): Step => {
      return {
        titleId: "create-catalog-storage-custom-title",
        disabled: storageChoice.storageType == "existing",
        content: <FormFields
          state={customStorage}
          setState={setCustomStorage}
          disabled={disabled}
          fields={
            [{
              type: "text",
              key: "storageName",
              label: "storage-name",
              required: storageChoice.storageType != "existing",
              props: {
                margin: "dense",
                size: "small",
              },
            }, {
              type: "text",
              key: "accessKeyId",
              label: "storage-access-key",
              required: storageChoice.storageType != "existing",
              props: {
                margin: "dense",
                size: "small",
              },
            }, {
              type: "text",
              key: "secretAccessKey",
              label: "storage-secret-key",
              required: storageChoice.storageType != "existing",
              props: {
                margin: "dense",
                size: "small",
              },
            }, {
              type: "text",
              key: "bucket",
              required: storageChoice.storageType != "existing",
              label: "storage-bucket",
              props: {
                margin: "dense",
                size: "small",
              },
            }, {
              type: "text",
              key: "region",
              label: "storage-region",
              props: {
                margin: "dense",
                size: "small",
              },
            }, {
              type: "text",
              key: "path",
              label: "storage-path",
              props: {
                margin: "dense",
                size: "small",
              },
            }]
          }
        />,
      };
    }, [disabled, storageChoice, customStorage, setCustomStorage]),
    useMemo((): Step => {
      return {
        titleId: "create-catalog-catalog-title",
        content: <FormFields
          state={catalogState}
          setState={setCatalogState}
          disabled={disabled}
          fields={
            [{
              type: "text",
              key: "catalogName",
              label: "catalog-name",
              required: true,
            }]
          }
        />,
      };
    }, [disabled, catalogState, setCatalogState]),
  ];

  return <SteppedDialog
    error={error}
    disabled={disabled}
    onSubmit={onSubmit}
    onClose={actions.closeOverlay}
    onBackClick={onBack}
    onNextClick={onNext}
    currentStep={currentStep}
    canAdvance={canAdvance}
    titleId={props.user.catalogs.size == 0 ? "catalog-create-title-first" : "catalog-create-title"}
    submitId="catalog-create-submit"
    steps={steps}
  />;
}
