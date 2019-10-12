import React from "react";

import { DefaultPage, PageContent } from "../components/pages";

export default class UserPage extends React.Component {
  public render(): React.ReactNode {
    return <DefaultPage>
      <PageContent>
        <h1>User</h1>
      </PageContent>
    </DefaultPage>;
  }
}
