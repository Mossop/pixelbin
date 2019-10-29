import React from "react";
import { Link } from "react-router-dom";
import { connect } from "react-redux";

import { showLoginOverlay, showSignupOverlay, completeLogout, DispatchProps } from "../store/actions";
import { Button } from "../components/Button";
import { isLoggedIn } from "../utils/helpers";
import { If, Then, Else } from "../utils/Conditions";
import { logout } from "../api/auth";

const mapDispatchToProps = {
  openLoginOverlay: showLoginOverlay,
  openSignupOverlay: showSignupOverlay,
  completeLogout: completeLogout,
};

type BannerProps = DispatchProps<typeof mapDispatchToProps>;

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

export default connect(null, mapDispatchToProps)(Banner);