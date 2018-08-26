import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import ImageCanvas from "./ImageCanvas";

const mapStateToProps = () => ({
  thumbsize: 150,
});

const Upload = ({ bitmap, thumbsize, name, metadata: { tags }, onChangeTags }) => {
  return (
    <div className="media">
      <ImageCanvas bitmap={bitmap} size={thumbsize}/>
      <p>{name}</p>
      <input type="text" onChange={onChangeTags} value={tags}/>
    </div>
  );
};

Upload.propTypes = {
  name: PropTypes.string.isRequired,
  bitmap: PropTypes.object.isRequired,
  metadata: PropTypes.string.isRequired,
  thumbsize: PropTypes.number.isRequired,
  onChangeTags: PropTypes.func.isRequired,
};

export default connect(mapStateToProps)(Upload);
