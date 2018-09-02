import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import ImageCanvas from "./ImageCanvas";

const mapStateToProps = () => ({
  thumbsize: 150,
});

const Upload = ({ bitmap, thumbsize, metadata: { tags, date }, onChangeTags, onChangeDate, onChangeTime }) => {
  return (
    <div className="media">
      <ImageCanvas bitmap={bitmap} size={thumbsize}/>
      <input type="text" onChange={onChangeTags} value={tags} style={{ marginTop: "10px" }}/>
      <input type="time" onChange={onChangeTime} value={date.format("HH:mm")} style={{ marginTop: "10px" }}/>
      <input type="date" onChange={onChangeDate} value={date.format("YYYY-MM-DD")} style={{ marginTop: "10px" }}/>
    </div>
  );
};

Upload.propTypes = {
  bitmap: PropTypes.object,
  metadata: PropTypes.object.isRequired,
  thumbsize: PropTypes.number.isRequired,
  onChangeTags: PropTypes.func.isRequired,
  onChangeDate: PropTypes.func.isRequired,
  onChangeTime: PropTypes.func.isRequired,
};

export default connect(mapStateToProps)(Upload);
