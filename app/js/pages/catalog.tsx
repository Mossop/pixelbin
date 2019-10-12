import React from "react";

import { DefaultPage, PageContent } from "../components/pages";

export default class CatalogPage extends React.Component {
  public render(): React.ReactNode {
    return <DefaultPage>
      <PageContent>
        <h1>Catalog</h1>
      </PageContent>
    </DefaultPage>;
  }
}
