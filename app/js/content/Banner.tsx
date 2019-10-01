import React from "react";
import { Link } from "react-router-dom";

import { Button } from "../content/Button";
import { loggedIn } from "../utils/helpers";
import { If, Then, Else } from "../utils/if";

class Banner extends React.Component {
  public login = (): void => {

  };

  public render(): React.ReactNode {
    return <div id="banner">
      <h1 id="logo"><Link to="/">PixelBin</Link></h1>
      <div id="rightbanner">
        <If condition={loggedIn}>
          <Then>
            <Link to="/upload">Upload</Link>
            <Link to="/logout">Log Out</Link>
          </Then>
          <Else>
            <Button onClick={this.login}>Log In</Button>
            <Link to="/signup">Sign Up</Link>
          </Else>
        </If>
      </div>
    </div>
  }
};

export default Banner;
