import React from "react";
import PropTypes from "prop-types";
import { Redirect } from "react-router";
import { connect } from "react-redux";

import { logout } from "../api/auth";
import { If, Then, Else } from "../utils/if";
import { loggedIn } from "../utils/helpers";
import { clearUser } from "../utils/actions";

const mapDispatchToProps = (dispatch) => ({
  onLogout: () => dispatch(clearUser()),
});

class LogoutPage extends React.Component {
  constructor(props) {
    super(props);
  }

  async componentDidMount() {
    await logout();
    this.props.onLogout();
  }

  render() {
    return (
      <If condition={loggedIn}>
        <Then>
          <div id="content" className="centerblock">
            <p>Logging out...</p>
          </div>
        </Then>
        <Else>
          <Redirect to="/"/>
        </Else>
      </If>
    );
  }
}

LogoutPage.propTypes = {
  onLogout: PropTypes.func.isRequired,
};

export default connect(null, mapDispatchToProps)(LogoutPage);
