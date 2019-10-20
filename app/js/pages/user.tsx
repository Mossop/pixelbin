import React from "react";

import { BasePageProps, BasePage, baseConnect } from "../components/BasePage";
import { RouteComponentProps } from "react-router";

class UserPage extends BasePage<BasePageProps & RouteComponentProps> {
  public renderContent(): React.ReactNode {
    return <h1>User</h1>;
  }
}

export default baseConnect(UserPage);
