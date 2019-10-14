import React from "react";

import { DefaultPage, PageContent } from "../components/pages";
import { RouteComponentProps } from "react-router";

interface MatchParams {
  id: string;
}

export default class CatalogPage extends React.Component<RouteComponentProps<MatchParams>> {
  public render(): React.ReactNode {
    return <DefaultPage sidebarSelected={this.props.match.params.id}>
      <PageContent>
        <h1>Catalog {this.props.match.params.id}</h1>
      </PageContent>
    </DefaultPage>;
  }
}
