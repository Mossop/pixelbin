import React from "react";

import { StandardContent } from "../components/pages";
import { RouteComponentProps } from "react-router";

interface MatchParams {
  id: string;
}

export default class AlbumPage extends React.Component<RouteComponentProps<MatchParams>> {
  public render(): React.ReactNode {
    return <React.Fragment>
      <StandardContent>
        <h1>Album {this.props.match.params.id}</h1>
      </StandardContent>
    </React.Fragment>;
  }
}
