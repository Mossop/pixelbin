import { useLocalization, Localized } from "@fluent/react";
import Box from "@material-ui/core/Box";
import type { Theme } from "@material-ui/core/styles";
import { makeStyles, createStyles } from "@material-ui/core/styles";
import CheckCircle from "@material-ui/icons/CheckCircle";
import ErrorIcon from "@material-ui/icons/Error";
import { useCallback, useEffect, useState } from "react";

import type { Api, Requests } from "../../../model";
import { AWSResult } from "../../../model";
import { testStorage } from "../../api/catalog";
import Loading from "../../components/Loading";
import { errorString } from "../../utils/exception";
import type { ReactResult } from "../../utils/types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    testIcon: {
      fontSize: "5rem",
    },
    testText: {
      fontSize: "3rem",
    },
    testResult: {
      textAlign: "center",
      fontSize: "2rem",
      fontWeight: "bold",
    },
    success: {
      color: theme.palette.success.main,
    },
    failure: {
      color: theme.palette.error.main,
    },
  }));

export interface StorageTestProps {
  visible: boolean;
  storageConfig: Requests.StorageCreate;
  setCanProceed: (val: boolean) => void;
}

export default function StorageTest({
  visible,
  storageConfig,
  setCanProceed,
}: StorageTestProps): ReactResult {
  let { l10n } = useLocalization();
  let classes = useStyles();
  let [testResult, setTestResult] = useState<Api.StorageTestResult | null>(null);

  const startStorageTest = useCallback(async (): Promise<void> => {
    setCanProceed(false);
    setTestResult(null);

    try {
      let {
        name,
        ...config
      } = storageConfig;
      let result = await testStorage(config);
      setCanProceed(result.result == AWSResult.Success);
      setTestResult(result);
    } catch (e) {
      setTestResult({
        result: AWSResult.UnknownFailure,
        message: errorString(l10n, e),
      });
    }
  }, [l10n, storageConfig, setCanProceed]);

  useEffect(() => {
    if (visible) {
      void startStorageTest();
    }
  }, [startStorageTest, visible]);

  if (!testResult) {
    return <Loading id="storage-test-testing" flexGrow={1}/>;
  } else if (testResult.result != AWSResult.Success) {
    return <Box
      id="storage-test-failure"
      flexGrow={1}
      display="flex"
      flexDirection="column"
      justifyContent="flex-start"
      alignItems="center"
      className={classes.failure}
    >
      <ErrorIcon className={classes.testIcon}/>
      <Localized id={`aws-${testResult.result}`}>
        <h3 className={classes.testResult}/>
      </Localized>
      {
        testResult.message && <Box
          id="storage-failure-message"
          component="p"
          textAlign="center"
        >
          {testResult.message}
        </Box>
      }
    </Box>;
  } else {
    return <Box
      id="storage-test-success"
      flexGrow={1}
      display="flex"
      flexDirection="column"
      justifyContent="flex-start"
      alignItems="center"
      className={classes.success}
    >
      <CheckCircle className={classes.testIcon}/>
      <Localized id="storage-test-success">
        <h3 className={classes.testResult}/>
      </Localized>
    </Box>;
  }
}
