import React from "react";

import { DefaultPage, PageContent } from "../components/pages";
import { RouteComponentProps } from "react-router";

interface MatchParams {
  id: string;
}

export default class AlbumPage extends React.Component<RouteComponentProps<MatchParams>> {
  public render(): React.ReactNode {
    return <DefaultPage>
      <PageContent>
        <h1>Album {this.props.match.params.id}</h1>
      </PageContent>
    </DefaultPage>;
  }
}
