import React, { ErrorInfo, PureComponent } from "react";

import Overlay from "../overlays";
import Page from "../pages";
import ErrorPage from "../pages/error";

interface ErrorHandlerProps {
  children: React.ReactNode;
}

interface ErrorHandlerState {
  error?: string;
}

class ErrorHandler extends PureComponent<ErrorHandlerProps, ErrorHandlerState> {
  public constructor(props: ErrorHandlerProps) {
    super(props);
    this.state = {};
  }

  public static getDerivedStateFromError(error: Error): Partial<ErrorHandlerState> {
    return { error: String(error) };
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

export default function App(): React.ReactElement | null {
  return <ErrorHandler>
    <Page/>
    <Overlay/>
  </ErrorHandler>;
}
