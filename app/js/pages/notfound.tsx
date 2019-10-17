import React from "react";
import { PageContent, DefaultPage } from "../components/pages";

export default class NotFound extends React.Component {
  public render(): React.ReactNode {
    return <DefaultPage>
      <PageContent>
        Nothing to see here!
      </PageContent>
    </DefaultPage>;
  }
}
