import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Radio from "@material-ui/core/Radio";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import CheckCircle from "@material-ui/icons/CheckCircle";
import ErrorIcon from "@material-ui/icons/Error";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Api, AWSResult } from "../../model";
import { testStorage, createCatalog, createStorage } from "../api/catalog";
import { StorageState, UserState } from "../api/types";
import FormFields, { Option } from "../components/FormFields";
import Loading from "../components/Loading";
import SteppedDialog, { Step } from "../components/SteppedDialog";
import { useActions } from "../store/actions";
import { AppError, errorString } from "../utils/exception";
import { useFormState } from "../utils/hooks";
import { ReactResult } from "../utils/types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    testIcon: {
      fontSize: "5rem",
    },
    testText: {
      fontSize: "3rem",
    },
    success: {
      color: theme.palette.success.main,
    },
    failure: {
      color: theme.palette.error.main,
    },
  }));

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
  let classes = useStyles();

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

  let storageChooserStep = useMemo((): Step => {
    return {
      titleId: "create-catalog-storage-title",
      content: <React.Fragment>
        {
          user.storage.size > 0 && <React.Fragment>
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
                      user.storage.values(),
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
      </React.Fragment>,
    };
  }, [
    disabled,
    user.storage,
    onStorageTypeChange,
    storageChoice,
    setStorageChoice,
  ]);

  let storageNameRef = useRef<HTMLElement>();
  let storageConfigStep = useMemo((): Step => {
    return {
      titleId: "create-catalog-storage-custom-title",
      disabled: storageChoice.storageType == "existing",
      content: <FormFields
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
      />,
    };
  }, [disabled, storageChoice, storageConfig, setStorageConfig]);

  let storageTestStep = useMemo((): Step => {
    let content: ReactResult;
    if (!storageTestResult) {
      content = <Loading id="storage-test-testing" flexGrow={1}/>;
    } else if (storageTestResult.result != AWSResult.Success) {
      content = <Box
        id="storage-test-failure"
        flexGrow={1}
        display="flex"
        flexDirection="column"
        justifyContent="flex-start"
        alignItems="center"
        className={classes.failure}
      >
        <ErrorIcon className={classes.testIcon}/>
        <Typography id="storage-test-result" variant="h4" align="center">
          {l10n.getString(`aws-${storageTestResult.result}`)}
        </Typography>
        {
          storageTestResult.message && <Box
            id="storage-failure-message"
            component="p"
            textAlign="center"
          >
            {storageTestResult.message}
          </Box>
        }
      </Box>;
    } else {
      content = <Box
        id="storage-test-success"
        flexGrow={1}
        display="flex"
        flexDirection="row"
        justifyContent="flex-start"
        alignItems="center"
        className={classes.success}
      >
        <CheckCircle className={classes.testIcon}/>
        <Typography id="storage-test-result" variant="h4" align="center">
          {l10n.getString("storage-test-success")}
        </Typography>
      </Box>;
    }

    return {
      titleId: "create-catalog-storage-test",
      disabled: storageChoice.storageType == "existing",
      content,
    };
  }, [storageChoice, storageTestResult, l10n, classes]);

  let catalogNameRef = useRef<HTMLElement>();
  let catalogNameStep = useMemo((): Step => {
    return {
      titleId: "create-catalog-catalog-title",
      content: <FormFields
        id="stepped-dialog"
        state={catalogState}
        setState={setCatalogState}
        disabled={disabled}
        fields={
          [{
            type: "text",
            ref: catalogNameRef,
            key: "catalogName",
            label: "catalog-name",
            required: true,
          }]
        }
      />,
    };
  }, [disabled, catalogState, setCatalogState]);

  let steps = useMemo(() => [
    storageChooserStep,
    storageConfigStep,
    storageTestStep,
    catalogNameStep,
  ], [
    storageChooserStep,
    storageConfigStep,
    storageTestStep,
    catalogNameStep,
  ]);

  useEffect(() => {
    switch (steps[currentStep]) {
      case storageConfigStep:
        storageNameRef.current?.focus();
        break;
      case catalogNameStep:
        catalogNameRef.current?.focus();
        break;
    }
  }, [
    steps,
    currentStep,
    storageChooserStep,
    storageConfigStep,
    storageTestStep,
    catalogNameStep,
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
      console.trace(e);
      setStorageTestResult({
        result: AWSResult.UnknownFailure,
        message: errorString(l10n, e),
      });
    }
  }, [storageChoice, storageConfig, setStorageTestResult, l10n]);

  let onBack = useCallback(() => {
    let nextStep = currentStep - 1;
    while (steps[nextStep].disabled) {
      nextStep--;
    }

    setCurrentStep(nextStep);
  }, [currentStep, steps]);

  let onNext = useCallback(() => {
    let nextStep = currentStep + 1;
    while (steps[nextStep].disabled) {
      nextStep++;
    }

    if (steps[nextStep] == storageTestStep) {
      void startStorageTest();
    }

    setCurrentStep(nextStep);
  }, [currentStep, storageTestStep, steps, startStorageTest]);

  let canAdvance = useMemo((): boolean => {
    switch (steps[currentStep]) {
      case storageChooserStep:
        return storageChoice.storageType != "compatible" || isFilled(storageChoice.endpoint);
      case storageConfigStep:
        return isFilled(storageConfig.storageName) && isFilled(storageConfig.accessKeyId) &&
          isFilled(storageConfig.secretAccessKey) && isFilled(storageConfig.bucket);
      case storageTestStep:
        return storageTestResult?.result == AWSResult.Success;
      case catalogNameStep:
        return isFilled(catalogState.catalogName);
    }

    return true;
  }, [
    steps,
    currentStep,
    storageChoice,
    storageConfig,
    catalogState,
    storageChooserStep,
    storageConfigStep,
    catalogNameStep,
    storageTestResult,
    storageTestStep,
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
    steps={steps}
  />;
}
