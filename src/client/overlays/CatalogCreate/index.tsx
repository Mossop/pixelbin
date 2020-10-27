import React, { useCallback, useMemo, useState } from "react";

import type { Api } from "../../../model";
import { createCatalog, createStorage } from "../../api/catalog";
import type { UserState } from "../../api/types";
import { useFormState } from "../../components/Forms";
import SteppedDialog, { Step } from "../../components/Forms/SteppedDialog";
import { useActions } from "../../store/actions";
import type { AppError } from "../../utils/exception";
import type { ReactResult } from "../../utils/types";
import CatalogConfig from "./CatalogConfig";
import StorageChooser from "./StorageChooser";
import StorageConfig from "./StorageConfig";
import StorageTest from "./StorageTest";

export interface CatalogCreateState {
  storageType: string;
  existingStorage: string;
  storageConfig: Api.StorageCreateRequest,
  catalogName: string;
}

export interface CatalogCreateOverlayProps {
  user: UserState;
}

export default function CatalogCreateOverlay({ user }: CatalogCreateOverlayProps): ReactResult {
  let [disabled, setDisabled] = useState(false);
  let [error, setError] = useState<AppError | null>(null);
  let actions = useActions();
  let [currentStep, setCurrentStep] = useState(0);
  let state = useFormState<CatalogCreateState>({
    storageType: user.storage.size ? "existing" : "aws",
    existingStorage: user.storage.size ? [...user.storage.values()][0].id : "",
    storageConfig: {
      name: "",
      accessKeyId: "",
      secretAccessKey: "",
      bucket: "",
      region: "",
      path: null,
      endpoint: null,
      publicUrl: null,
    },
    catalogName: "",
  });
  let [storageValid, setStorageValid] = useState(true);

  let onSubmit = useCallback(async (): Promise<void> => {
    setDisabled(true);
    setError(null);

    try {
      let storageId = state.existingStorage.value;

      if (state.storageType.value != "existing") {
        let storage = await createStorage(state.storageConfig.value);

        actions.storageCreated(storage);
        // In case the catalog creation fails for some odd reason configure to use
        // the new storage.
        state.existingStorage.set(storage.id);
        state.storageType.set("existing");

        storageId = storage.id;
      }

      let catalog = await createCatalog(state.catalogName.value, storageId);
      actions.catalogCreated(catalog);
    } catch (e) {
      setError(e);
      setDisabled(false);
    }
  }, [actions, state]);

  let isFilled = (val: { value: string | null }): boolean => !!val.value;

  let onBack = useCallback(() => {
    let nextStep = currentStep - 1;
    if (nextStep == 2) {
      nextStep = 1;
    }

    if (state.storageType.value == "existing" && nextStep == 1) {
      nextStep = 0;
    }

    setCurrentStep(nextStep);
  }, [currentStep, state]);

  let onNext = useCallback(() => {
    let nextStep = currentStep + 1;
    if (state.storageType.value == "existing" && nextStep > 0 && nextStep < 3) {
      nextStep = 3;
    }

    setCurrentStep(nextStep);
  }, [currentStep, state]);

  let canAdvance = useMemo((): boolean => {
    switch (currentStep) {
      case 0:
        return state.storageType.value != "compatible" || isFilled(state.storageConfig.endpoint);
      case 1:
        return isFilled(state.storageConfig.name) && isFilled(state.storageConfig.accessKeyId) &&
          isFilled(state.storageConfig.secretAccessKey) && isFilled(state.storageConfig.bucket);
      case 2:
        return storageValid;
      case 3:
        return isFilled(state.catalogName);
    }

    return true;
  }, [
    currentStep,
    state,
    storageValid,
  ]);

  return <SteppedDialog
    error={error}
    disabled={disabled}
    onSubmit={onSubmit}
    onClose={actions.closeOverlay}
    onBackClick={onBack}
    onNextClick={onNext}
    currentStep={currentStep}
    canAdvance={canAdvance}
    titleId={user.catalogs.size == 0 ? "catalog-create-title-first" : "catalog-create-title"}
    submitId="catalog-create-submit"
  >
    <Step titleId="create-catalog-storage-title">
      <StorageChooser
        visible={currentStep == 0}
        storage={user.storage}
        state={state}
      />
    </Step>
    <Step
      titleId="create-catalog-storage-custom-title"
      disabled={state.storageType.value == "existing"}
    >
      <StorageConfig
        visible={currentStep == 1}
        storageType={state.storageType.value}
        state={state.storageConfig}
      />
    </Step>
    <Step
      titleId="create-catalog-storage-test"
      disabled={state.storageType.value == "existing"}
    >
      <StorageTest
        visible={currentStep == 2}
        storageConfig={state.storageConfig.value}
        setCanProceed={setStorageValid}
      />
    </Step>
    <Step titleId="create-catalog-catalog-title">
      <CatalogConfig
        visible={currentStep == 3}
        state={state.catalogName}
      />
    </Step>
  </SteppedDialog>;
}
