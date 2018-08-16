import React from "react";

import { If, Then, Else } from "../utils/if";
import { loggedIn } from "../utils/helpers";

const IndexPage = () => {
  return (
    <If condition={loggedIn}>
      <Else>
        <div id="content">
        </div>
      </Else>
    </If>
  );
};

export default IndexPage;
