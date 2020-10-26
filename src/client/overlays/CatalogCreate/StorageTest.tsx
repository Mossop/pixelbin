import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import { Theme, makeStyles, createStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import CheckCircle from "@material-ui/icons/CheckCircle";
import ErrorIcon from "@material-ui/icons/Error";
import React from "react";

import { Api, AWSResult } from "../../../model";
import Loading from "../../components/Loading";
import { ReactResult } from "../../utils/types";

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

export interface StorageTestProps {
  storageTestResult: Api.StorageTestResult | null;
}

export default function StorageTest({
  storageTestResult,
}: StorageTestProps): ReactResult {
  let { l10n } = useLocalization();
  let classes = useStyles();

  if (!storageTestResult) {
    return <Loading id="storage-test-testing" flexGrow={1}/>;
  } else if (storageTestResult.result != AWSResult.Success) {
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
    return <Box
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
}
