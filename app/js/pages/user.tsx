import React from "react";

import { BasePage, baseConnect } from "../components/BasePage";

class UserPage extends BasePage {
  public renderContent(): React.ReactNode {
    return <h1>User</h1>;
  }
}

export default baseConnect()(UserPage);
