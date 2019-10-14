import React from "react";

import { PageContent, DefaultPage } from "../components/pages";
import { RouteComponentProps } from "react-router";

export default class IndexPage extends React.Component<RouteComponentProps> {
  public render(): React.ReactNode {
    return <DefaultPage>
      <PageContent>
        <h1>Index</h1>
      </PageContent>
    </DefaultPage>;
  }
}
