import React from "react";
import { Link } from "react-router-dom";

import { logout } from "../api/auth";
import { showLoginOverlay, showSignupOverlay, completeLogout } from "../store/actions";
import { If, Then, Else } from "../utils/Conditions";
import { isLoggedIn } from "../utils/helpers";
import { Button } from "./Button";
import { ComponentProps, connect } from "./shared";

const mapDispatchToProps = {
  openLoginOverlay: showLoginOverlay,
  openSignupOverlay: showSignupOverlay,
  completeLogout: completeLogout,
};

type BannerProps = ComponentProps<{}, {}, typeof mapDispatchToProps>;
class Banner extends React.Component<BannerProps> {
  private logout: (() => void) = async (): Promise<void> => {
    let state = await logout();
    this.props.completeLogout(state);
  };

  public render(): React.ReactNode {
    return <div id="banner">
      <h1 id="logo"><Link to="/">PixelBin</Link></h1>
      <div id="rightbanner">
        {this.props.children}
        <If condition={isLoggedIn}>
          <Then>
            <Button l10n="banner-logout" onClick={this.logout}/>
          </Then>
          <Else>
            <Button l10n="banner-login" onClick={this.props.openLoginOverlay}/>
            <Button l10n="banner-signup" onClick={this.props.openSignupOverlay}/>
          </Else>
        </If>
      </div>
    </div>;
  }
}

export default connect<{}>()(undefined, mapDispatchToProps)(Banner);
