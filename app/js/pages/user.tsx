import React from "react";

import { DefaultPage, PageContent } from "../components/pages";
import { RouteComponentProps } from "react-router";

export default class UserPage extends React.Component<RouteComponentProps> {
  public render(): React.ReactNode {
    return <DefaultPage>
      <PageContent>
        <h1>User</h1>
      </PageContent>
    </DefaultPage>;
  }
}
