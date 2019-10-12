import React from "react";
import PropTypes from "prop-types";
import { Redirect } from "react-router";
import { connect } from "react-redux";

import { logout } from "../api/auth";
import { If, Then, Else } from "../utils/Conditions";
import { isLoggedIn } from "../utils/helpers";
import { setState } from "../utils/actions";

const mapDispatchToProps = (dispatch) => ({
  onNewState: (state) => dispatch(setState(state)),
});

class LogoutPage extends React.Component {
  constructor(props) {
    super(props);
  }

  async componentDidMount() {
    let state = await logout();
    this.props.onNewState(state);
  }

  render() {
    return (
      <If condition={isLoggedIn}>
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
  onNewState: PropTypes.func.isRequired,
};

export default connect(null, mapDispatchToProps)(LogoutPage);
