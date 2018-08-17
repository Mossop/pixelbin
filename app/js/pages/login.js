import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Redirect } from "react-router";

import { login } from "../api/auth";
import { If, Then, Else } from "../utils/if";
import { loggedIn } from "../utils/helpers";

import { setUser } from "../utils/actions";

const mapDispatchToProps = (dispatch) => ({
  onLogin: (email, fullname) => dispatch(setUser(email, fullname)),
});

class LoginPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      disabled: false,
      email: "",
      password: "",
    };

    this.onEmailChange = this.onEmailChange.bind(this);
    this.onPasswordChange = this.onPasswordChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
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
      let details = await login(this.state.email, this.state.password);
      this.props.onLogin(details.email, details.fullname);
    } catch (e) {
      this.setState({ disabled: false, failed: true });
    }
  }

  render() {
    return (
      <If condition={loggedIn}>
        <Then>
          <Redirect to="/"/>
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
  onLogin: PropTypes.func.isRequired,
};

export default connect(null, mapDispatchToProps)(LoginPage);
