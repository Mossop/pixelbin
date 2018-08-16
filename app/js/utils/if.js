import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

export const Then = ({ children }) => children;
Then.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
};
export const Else = ({ children }) => children;
Else.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
};

function calculateResult(state, { condition }) {
  let result = condition;
  if (typeof result == "function") {
    result = result(state);
  }

  return { result };
}

const If = ({ result, children }) => {
  let element = null;
  React.Children.forEach(children, child => {
    if (React.isValidElement(child)) {
      if (result && child.type == Then) {
        element = child;
      }
      else if (!result && child.type == Else) {
        element = child;
      }
    }
  });

  return element;
};

If.propTypes = {
  condition: PropTypes.oneOfType([ PropTypes.bool, PropTypes.func ]).isRequired,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
};

const ConnectedIf = connect(calculateResult)(If);

export { ConnectedIf as If };
