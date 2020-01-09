import React from "react";
import { RouteComponentProps } from "react-router";

import { BasePage, baseConnect } from "../components/BasePage";
import { ComponentProps } from "../components/shared";

type PassedProps = RouteComponentProps;

type IndexPageProps = ComponentProps<PassedProps>;
class IndexPage extends BasePage<IndexPageProps> {
  public renderContent(): React.ReactNode {
    return <h1>Index</h1>;
  }
}

export default baseConnect(IndexPage);
