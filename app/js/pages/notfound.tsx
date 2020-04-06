import React, { ReactNode } from "react";

import { BasePage, baseConnect } from "./BasePage";

class NotFoundPage extends BasePage {
  public renderContent(): ReactNode {
    return <h1>Not found</h1>;
  }
}

export default baseConnect()(NotFoundPage);
