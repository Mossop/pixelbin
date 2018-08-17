import React from "react";

import { If, Then, Else } from "../utils/if";
import { loggedIn } from "../utils/helpers";
import Sidebar from "../content/sidebar";

const IndexPage = () => {
  return (
    <If condition={loggedIn}>
      <Then>
        <div id="splitmain">
          <Sidebar/>
          <div id="content">
            <p>Home</p>
          </div>
        </div>
      </Then>
      <Else>
        <div id="content">
        </div>
      </Else>
    </If>
  );
};

export default IndexPage;
