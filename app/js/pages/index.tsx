import React from "react";

import { BasePageProps, BasePage, baseConnect } from "../components/BasePage";
import { RouteComponentProps } from "react-router";

class IndexPage extends BasePage<BasePageProps & RouteComponentProps> {
  public renderContent(): React.ReactNode {
    return <h1>Index</h1>;
  }
}

export default baseConnect(IndexPage);
