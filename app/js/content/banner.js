import React from "react";
import { Link } from "react-router-dom";

import { loggedIn } from "../utils/helpers";
import { If, Then, Else } from "../utils/if";

const Banner = () => {
  return (
    <div id="banner">
      <h1 id="logo"><Link to="/">PixelBin</Link></h1>
      <div id="rightbanner">
        <If condition={loggedIn}>
          <Then>
            <Link to="/upload">Upload</Link>
            <Link to="/logout">Log Out</Link>
          </Then>
          <Else>
            <Link to="/login">Log In</Link>
            <Link to="/signup">Sign Up</Link>
          </Else>
        </If>
      </div>
    </div>
  );
};

export default Banner;
