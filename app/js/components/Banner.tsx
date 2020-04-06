import React, { PureComponent, ReactNode } from "react";

import { logout } from "../api/auth";
import { PageType } from "../pages";
import actions from "../store/actions";
import { connect, ComponentProps } from "../utils/component";
import { If, Then, Else } from "../utils/Conditions";
import { isLoggedIn } from "../utils/helpers";
import Button from "./Button";
import Link from "./Link";

const mapDispatchToProps = {
  openLoginOverlay: actions.showLoginOverlay,
  openSignupOverlay: actions.showSignupOverlay,
  completeLogout: actions.completeLogout,
};

class Banner extends PureComponent<ComponentProps<{}, {}, typeof mapDispatchToProps>> {
  private logout = async (): Promise<void> => {
    let state = await logout();
    this.props.completeLogout(state);
  };

  public render(): ReactNode {
    return <div id="banner">
      <h1 id="logo"><Link to={{ page: { type: PageType.Index } }}>PixelBin</Link></h1>
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

export default connect()(Banner, undefined, mapDispatchToProps);
