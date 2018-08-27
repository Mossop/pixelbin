import React from "react";
import PropTypes from "prop-types";

const Throbber = ({ style = {} }) => {
  return (
    <div className="centerblock" style={style}>
      <div className="throbber"/>
    </div>
  );
};

Throbber.propTypes = {
  style: PropTypes.object,
};

export default Throbber;
