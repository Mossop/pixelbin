import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import { buildThumbURL } from "../api/media";

const mapStateToProps = () => ({
  thumbsize: 150,
});

const Media = ({ thumbsize, media }) => {
  let thumburl = buildThumbURL(media.id, thumbsize);
  return (
    <div className="media">
      <div style={{ width: thumbsize, height: thumbsize, background: `url(${thumburl}) center center no-repeat` }}></div>
    </div>
  );
};

Media.propTypes = {
  thumbsize: PropTypes.number.isRequired,
  media: PropTypes.object.isRequired,
};

export default connect(mapStateToProps)(Media);
