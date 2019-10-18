import React from "react";

import { DefaultPage } from "../components/pages";
import { RouteComponentProps } from "react-router";

export default class IndexPage extends React.Component<RouteComponentProps> {
  public render(): React.ReactNode {
    return <DefaultPage>
      <h1>Index</h1>
    </DefaultPage>;
  }
}
