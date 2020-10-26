import { useLocalization } from "@fluent/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Api, AWSResult } from "../../../model";
import { testStorage, createCatalog, createStorage } from "../../api/catalog";
import { UserState } from "../../api/types";
import SteppedDialog, { Step } from "../../components/SteppedDialog";
import { useActions } from "../../store/actions";
import { AppError, errorString } from "../../utils/exception";
import { useFormState } from "../../utils/hooks";
import { ReactResult } from "../../utils/types";
import CatalogConfig from "./CatalogConfig";
import StorageChooser from "./StorageChooser";
import StorageConfig from "./StorageConfig";
import StorageTest from "./StorageTest";

export interface CatalogCreateOverlayProps {
  user: UserState;
}

export default function CatalogCreateOverlay({ user }: CatalogCreateOverlayProps): ReactResult {
  let { l10n } = useLocalization();
  let [disabled, setDisabled] = useState(false);
  let [error, setError] = useState<AppError | null>(null);
  let actions = useActions();
  let [currentStep, setCurrentStep] = useState(0);
  let [storageTestResult, setStorageTestResult] = useState<Api.StorageTestResult | null>(null);

  let [storageChoice, setStorageChoice] = useFormState({
    storageType: user.storage.size ? "existing" : "aws",
    existingStorage: user.storage.size ? [...user.storage.values()][0].id : "",
    endpoint: "",
    publicUrl: "",
  });

  let [storageConfig, setStorageConfig] = useFormState({
    storageName: "",
    accessKeyId: "",
    secretAccessKey: "",
    bucket: "",
    region: "",
    path: "",
  });

  let [catalogState, setCatalogState] = useFormState({
    catalogName: "",
  });

  let onSubmit = useCallback(async (): Promise<void> => {
    setDisabled(true);
    setError(null);

    try {
      let storageId = storageChoice.existingStorage;
      let endpoint: string | null = null;
      let publicUrl: string | null = null;

      if (storageChoice.storageType == "compatible") {
        endpoint = storageChoice.endpoint;
        publicUrl = storageChoice.publicUrl.length > 0 ? storageChoice.publicUrl : null;
      }

      if (storageChoice.storageType != "existing") {
        let storage = await createStorage({
          name: storageConfig.storageName,
          accessKeyId: storageConfig.accessKeyId,
          secretAccessKey: storageConfig.secretAccessKey,
          bucket: storageConfig.bucket,
          region: storageConfig.region,
          path: storageConfig.path ? storageConfig.path : null,
          endpoint,
          publicUrl,
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
      setDisabled(false);
    }
  }, [actions, storageConfig, catalogState, storageChoice, setStorageChoice]);

  let onStorageTypeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    // @ts-ignore
    setStorageChoice("storageType", event.target.value);
  }, [setStorageChoice]);

  let isFilled = (val: string): boolean => val.length > 0;

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
    setStorageTestResult(null);

    let endpoint = storageChoice.storageType == "compatible" ? storageChoice.endpoint : null;
    let path = storageConfig.path ? storageConfig.path : null;

    try {
      setStorageTestResult(await testStorage({
        endpoint,
        accessKeyId: storageConfig.accessKeyId,
        secretAccessKey: storageConfig.secretAccessKey,
        path,
        bucket: storageConfig.bucket,
        region: storageConfig.region,
        publicUrl: storageChoice.publicUrl ? storageChoice.publicUrl : null,
      }));
    } catch (e) {
      setStorageTestResult({
        result: AWSResult.UnknownFailure,
        message: errorString(l10n, e),
      });
    }
  }, [storageChoice, storageConfig, setStorageTestResult, l10n]);

  let onBack = useCallback(() => {
    let nextStep = currentStep - 1;
    if (nextStep == 2) {
      nextStep = 1;
    }

    if (storageChoice.storageType == "existing" && nextStep == 1) {
      nextStep = 0;
    }

    setCurrentStep(nextStep);
  }, [currentStep, storageChoice]);

  let onNext = useCallback(() => {
    let nextStep = currentStep + 1;
    if (storageChoice.storageType == "existing" && nextStep > 0 && nextStep < 3) {
      nextStep = 3;
    }

    if (nextStep == 2) {
      void startStorageTest();
    }

    setCurrentStep(nextStep);
  }, [currentStep, startStorageTest, storageChoice]);

  let canAdvance = useMemo((): boolean => {
    switch (currentStep) {
      case 0:
        return storageChoice.storageType != "compatible" || isFilled(storageChoice.endpoint);
      case 1:
        return isFilled(storageConfig.storageName) && isFilled(storageConfig.accessKeyId) &&
          isFilled(storageConfig.secretAccessKey) && isFilled(storageConfig.bucket);
      case 2:
        return storageTestResult?.result == AWSResult.Success;
      case 3:
        return isFilled(catalogState.catalogName);
    }

    return true;
  }, [
    currentStep,
    storageChoice,
    storageConfig,
    catalogState,
    storageTestResult,
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
        disabled={disabled}
        storage={user.storage}
        storageChoice={storageChoice}
        setStorageChoice={setStorageChoice}
        onStorageTypeChange={onStorageTypeChange}
      />
    </Step>
    <Step
      titleId="create-catalog-storage-custom-title"
      disabled={storageChoice.storageType == "existing"}
    >
      <StorageConfig
        disabled={disabled}
        storageChoice={storageChoice}
        storageConfig={storageConfig}
        setStorageConfig={setStorageConfig}
        storageNameRef={storageNameRef}
      />
    </Step>
    <Step
      titleId="create-catalog-storage-test"
      disabled={storageChoice.storageType == "existing"}
    >
      <StorageTest storageTestResult={storageTestResult}/>
    </Step>
    <Step titleId="create-catalog-catalog-title">
      <CatalogConfig
        disabled={disabled}
        catalogState={catalogState}
        setCatalogState={setCatalogState}
        catalogNameRef={catalogNameRef}
      />
    </Step>
  </SteppedDialog>;
}
