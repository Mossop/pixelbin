import React, { ReactNode } from "react";

import { BasePage, baseConnect } from "./BasePage";

class UserPage extends BasePage {
  public renderContent(): ReactNode {
    return <h1>User</h1>;
  }
}

export default baseConnect()(UserPage);
