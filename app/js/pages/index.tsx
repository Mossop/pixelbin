import React from "react";

import { PageContent, DefaultPage } from "../components/pages";

export default class IndexPage extends React.Component {
  public render(): React.ReactNode {
    return <DefaultPage>
      <PageContent>
        <h1>Index</h1>
      </PageContent>
    </DefaultPage>;
  }
}
