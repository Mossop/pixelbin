import React, { ReactNode } from "react";

import { UserState } from "../api/types";
import { AuthenticatedPage, baseConnect } from "./BasePage";

interface PassedProps {
  user: UserState;
}

class UserPage extends AuthenticatedPage<PassedProps> {
  public renderContent(): ReactNode {
    return <h1>User</h1>;
  }
}

export default baseConnect<PassedProps>()(UserPage);
