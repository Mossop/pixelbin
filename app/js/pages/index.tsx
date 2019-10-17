import React from "react";

import { StandardContent } from "../components/pages";
import { RouteComponentProps } from "react-router";

export default class IndexPage extends React.Component<RouteComponentProps> {
  public render(): React.ReactNode {
    return <React.Fragment>
      <StandardContent>
        <h1>Index</h1>
      </StandardContent>
    </React.Fragment>;
  }
}
