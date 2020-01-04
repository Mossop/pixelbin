import React from "react";
import { RouteComponentProps } from "react-router";

import { BasePageProps, BasePage, baseConnect } from "../components/BasePage";

class UserPage extends BasePage<BasePageProps & RouteComponentProps> {
  public renderContent(): React.ReactNode {
    return <h1>User</h1>;
  }
}

export default baseConnect(UserPage);
