import React from "react";

import { DefaultPage, PageContent } from "../components/pages";

export default class AlbumPage extends React.Component {
  public render(): React.ReactNode {
    return <DefaultPage>
      <PageContent>
        <h1>Album</h1>
      </PageContent>
    </DefaultPage>;
  }
}
