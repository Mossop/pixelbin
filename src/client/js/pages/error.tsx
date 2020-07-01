import { Localized } from "@fluent/react";
import React, { ReactNode, Fragment, PureComponent } from "react";

interface PassedProps {
  error: string;
}

class ErrorPage extends PureComponent<PassedProps> {
  public render(): ReactNode {
    return <Fragment>
      <div id="banner">
        <h1 id="logo"><a href="/">PixelBin</a></h1>
      </div>
      <div id="content">
        <Localized id="error-title"><h1/></Localized>
        <Localized id="error-content" vars={{ error: this.props.error }}><p/></Localized>
      </div>
    </Fragment>;
  }
}

export default ErrorPage;
