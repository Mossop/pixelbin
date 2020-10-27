import { useLocalization } from "@fluent/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Api, AWSResult } from "../../../model";
import { testStorage, createCatalog, createStorage } from "../../api/catalog";
import { UserState } from "../../api/types";
import { useFormState } from "../../components/Forms";
import SteppedDialog, { Step } from "../../components/Forms/SteppedDialog";
import { useActions } from "../../store/actions";
import { AppError, errorString } from "../../utils/exception";
import { ReactResult } from "../../utils/types";
import CatalogConfig from "./CatalogConfig";
import StorageChooser from "./StorageChooser";
import StorageConfig from "./StorageConfig";
import StorageTest from "./StorageTest";

export interface CatalogCreateState {
  storageType: string;
  existingStorage: string;
  storageConfig: Api.StorageCreateRequest,
  storageTestResult: Api.StorageTestResult | null,
  catalogName: string;
}

export interface CatalogCreateOverlayProps {
  user: UserState;
}

export default function CatalogCreateOverlay({ user }: CatalogCreateOverlayProps): ReactResult {
  let { l10n } = useLocalization();
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
    storageTestResult: null,
    catalogName: "",
  });

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

  let storageNameRef = useRef<HTMLElement>();
  let catalogNameRef = useRef<HTMLElement>();

  useEffect(() => {
    switch (currentStep) {
      case 1:
        storageNameRef.current?.focus();
        break;
      case 3:
        catalogNameRef.current?.focus();
        break;
    }
  }, [
    currentStep,
  ]);

  let startStorageTest = useCallback(async (): Promise<void> => {
    state.storageTestResult.set(null);

    try {
      let {
        name,
        ...storageConfig
      } = state.storageConfig.value;
      state.storageTestResult.set(await testStorage(storageConfig));
    } catch (e) {
      state.storageTestResult.set({
        result: AWSResult.UnknownFailure,
        message: errorString(l10n, e),
      });
    }
  }, [state, l10n]);

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

    if (nextStep == 2) {
      void startStorageTest();
    }

    setCurrentStep(nextStep);
  }, [currentStep, startStorageTest, state]);

  let canAdvance = useMemo((): boolean => {
    switch (currentStep) {
      case 0:
        return state.storageType.value != "compatible" || isFilled(state.storageConfig.endpoint);
      case 1:
        return isFilled(state.storageConfig.name) && isFilled(state.storageConfig.accessKeyId) &&
          isFilled(state.storageConfig.secretAccessKey) && isFilled(state.storageConfig.bucket);
      case 2:
        return state.storageTestResult.value?.result == AWSResult.Success;
      case 3:
        return isFilled(state.catalogName);
    }

    return true;
  }, [
    currentStep,
    state,
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
        storage={user.storage}
        state={state}
      />
    </Step>
    <Step
      titleId="create-catalog-storage-custom-title"
      disabled={state.storageType.value == "existing"}
    >
      <StorageConfig
        storageType={state.storageType.value}
        state={state.storageConfig}
        storageNameRef={storageNameRef}
      />
    </Step>
    <Step
      titleId="create-catalog-storage-test"
      disabled={state.storageType.value == "existing"}
    >
      <StorageTest storageTestResult={state.storageTestResult.value}/>
    </Step>
    <Step titleId="create-catalog-catalog-title">
      <CatalogConfig
        state={state.catalogName}
        catalogNameRef={catalogNameRef}
      />
    </Step>
  </SteppedDialog>;
}
