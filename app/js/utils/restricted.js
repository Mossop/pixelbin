import React from "react";
import { Route, Redirect } from "react-router";
import { connect } from "react-redux";

import { loggedIn } from "./helpers";

const mapStateToProps = (state) => ({
  authenticated: loggedIn(state),
});

class RestrictedRoute extends Route {
  render() {
    const { match } = this.state;
    if (!match) {
      return null;
    }

    const { component, authenticated } = this.props;

    if (!authenticated) {
      return <Redirect to="/login"/>;
    }

    const { history, route, staticContext } = this.context.router;
    const location = this.props.location || route.location;
    const props = { match, location, history, staticContext };

    return component ? React.createElement(component, props) : null;
  }
}

export default connect(mapStateToProps)(RestrictedRoute);
