import { Immutable } from "immer";
import React, { ReactNode } from "react";

import { UserData } from "../api/types";
import { AuthenticatedPage, baseConnect } from "./BasePage";

interface PassedProps {
  user: Immutable<UserData>;
}

class UserPage extends AuthenticatedPage<PassedProps> {
  public renderContent(): ReactNode {
    return <h1>User</h1>;
  }
}

export default baseConnect<PassedProps>()(UserPage);
