import React from "react";

import { BasePage, baseConnect } from "../components/BasePage";

class IndexPage extends BasePage {
  public renderContent(): React.ReactNode {
    return <h1>Index</h1>;
  }
}

export default baseConnect()(IndexPage);
