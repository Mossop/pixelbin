import React from "react";
import { Link } from "react-router-dom";
import { connect } from "react-redux";

import { showLoginOverlay, DispatchProps } from "../utils/actions";
import { Button } from "../components/Button";
import { loggedIn } from "../utils/helpers";
import { If, Then, Else } from "../utils/if";

const mapDispatchToProps = {
  openLoginOverlay: showLoginOverlay,
};

type BannerProps = DispatchProps<typeof mapDispatchToProps>;

class Banner extends React.Component<BannerProps> {
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
            <Button style={{ height: "100%" }} onClick={this.props.openLoginOverlay}>Log In</Button>
            <Button style={{ height: "100%" }} onClick={(): void => {}}>Sign Up</Button>
          </Else>
        </If>
      </div>
    </div>;
  }
}

export default connect(null, mapDispatchToProps)(Banner);
