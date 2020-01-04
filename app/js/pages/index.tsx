import React from "react";
import { RouteComponentProps } from "react-router";

import { BasePageProps, BasePage, baseConnect } from "../components/BasePage";

class IndexPage extends BasePage<BasePageProps & RouteComponentProps> {
  public renderContent(): React.ReactNode {
    return <h1>Index</h1>;
  }
}

export default baseConnect(IndexPage);
