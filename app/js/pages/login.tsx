import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Redirect } from "react-router";

import { login } from "../api/auth";
import { If, Then, Else } from "../utils/if";
import { loggedIn, bindAll } from "../utils/helpers";

import { setState } from "../utils/actions";

const mapDispatchToProps = (dispatch) => ({
  onNewState: (state) => dispatch(setState(state)),
});

class LoginPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      disabled: false,
      email: "",
      password: "",
    };

    bindAll(this, [
      "onEmailChange",
      "onPasswordChange",
      "onSubmit",
    ]);
  }

  onEmailChange(event) {
    this.setState({ email: event.target.value });
  }

  onPasswordChange(event) {
    this.setState({ password: event.target.value });
  }

  async onSubmit(event) {
    this.setState({ disabled: true });
    event.preventDefault();

    try {
      let state = await login(this.state.email, this.state.password);
      this.props.onNewState(state);
    } catch (e) {
      this.setState({ disabled: false, failed: true });
    }
  }

  nextURL() {
    if (this.props.location.search) {
      let params = new URLSearchParams(this.props.location.search);
      if (params.has("next")) {
        return params.get("next");
      }
    }

    return "/";
  }

  render() {
    return (
      <If condition={loggedIn}>
        <Then>
          <Redirect to={this.nextURL()}/>
        </Then>
        <Else>
          <div id="content" className="centerblock">
            <form id="loginForm" className="fieldGrid" onSubmit={this.onSubmit}>
              <p style={{ gridColumn: "span 2", justifySelf: "start" }}>Please enter your login details:</p>
              <p className="rightAlign"><label htmlFor="email">Email address:</label></p>
              <input type="email" id="email" disabled={this.state.disabled} value={this.state.email} onChange={this.onEmailChange}/>
              <p className="rightAlign"><label htmlFor="password">Password:</label></p>
              <input type="password" id="password" disabled={this.state.disabled} value={this.state.password} onChange={this.onPasswordChange}/>
              <p style={{ gridColumn: "span 2", justifySelf: "end" }}><input id="" type="submit" value="Log In" disabled={this.state.disabled}/></p>
            </form>
          </div>
        </Else>
      </If>
    );
  }
}

LoginPage.propTypes = {
  onNewState: PropTypes.func.isRequired,
  location: PropTypes.object.isRequired,
};

export default connect(null, mapDispatchToProps)(LoginPage);
