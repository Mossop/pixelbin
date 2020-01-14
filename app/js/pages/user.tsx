import React from "react";
import { RouteComponentProps } from "react-router";

import { BasePage, baseConnect, BasePageProps } from "../components/BasePage";
import { ComponentProps } from "../components/shared";

type PassedProps = BasePageProps & RouteComponentProps;

type UserPageProps = ComponentProps<PassedProps>;
class UserPage extends BasePage<UserPageProps> {
  public renderContent(): React.ReactNode {
    return <h1>User</h1>;
  }
}

export default baseConnect(UserPage);
