import React from "react";
import { Route, Redirect } from "react-router";
import { connect } from "react-redux";

import { isLoggedIn } from "./helpers";

const mapStateToProps = (state) => ({
  authenticated: isLoggedIn(state),
});

class RestrictedRoute extends Route {
  render() {
    const { match } = this.state;
    if (!match) {
      return null;
    }

    const { component, authenticated } = this.props;
    const { history, route, staticContext } = this.context.router;
    const location = this.props.location || route.location;

    if (!authenticated) {
      let params = new URLSearchParams();
      params.append("next", location.pathname + location.search);
      return <Redirect to={`/login?${params.toString()}`}/>;
    }

    const props = { match, location, history, staticContext };

    return component ? React.createElement(component, props) : null;
  }
}

export default connect(mapStateToProps)(RestrictedRoute);
