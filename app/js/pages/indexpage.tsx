import React, { ReactNode } from "react";

import { BasePage, baseConnect } from "../components/BasePage";

class IndexPage extends BasePage {
  public renderContent(): ReactNode {
    return <h1>Index</h1>;
  }
}

export default baseConnect()(IndexPage);
