import { useLocalization } from "@fluent/react";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import type { ErrorInfo } from "react";
import React, { PureComponent, Suspense } from "react";

import Dialog from "../dialogs";
import Page from "../pages";
import ErrorPage from "../pages/Error";
import Loading from "./Loading";
import PageComponent from "./Page";

interface ErrorHandlerProps {
  children: React.ReactNode;
}

interface ErrorHandlerState {
  error?: Error;
}

class ErrorHandler extends PureComponent<ErrorHandlerProps, ErrorHandlerState> {
  public constructor(props: ErrorHandlerProps) {
    super(props);
    this.state = {};
  }

  public static getDerivedStateFromError(error: Error): Partial<ErrorHandlerState> {
    return { error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(error, errorInfo.componentStack);
  }

  public render(): React.ReactNode {
    if (this.state.error) {
      return <ErrorPage error={this.state.error}/>;
    }

    return this.props.children;
  }
}

const useStyles = makeStyles(() =>
  createStyles({
    app: {
      height: "100vh",
      width: "100vw",
      position: "relative",
    },
  }));

export default function App(): React.ReactElement | null {
  let { l10n } = useLocalization();
  let classes = useStyles();

  return <div className={classes.app}>
    <ErrorHandler>
      <Suspense
        fallback={
          <PageComponent title={l10n.getString("loading-title")}>
            <Loading flexGrow={1}/>
          </PageComponent>
        }
      >
        <Page/>
      </Suspense>
      <Suspense fallback={null}>
        <Dialog/>
      </Suspense>
    </ErrorHandler>
  </div>;
}
