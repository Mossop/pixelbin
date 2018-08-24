import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import { drawBitmapToCanvas } from "../utils/helpers";

const mapStateToProps = () => ({
  thumbsize: 150,
});

class Upload extends React.Component {
  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
  }

  componentDidMount() {
    drawBitmapToCanvas(this.props.bitmap, this.canvasRef.current);
  }

  render() {
    return (
      <div className="media">
        <canvas ref={this.canvasRef} height={this.props.thumbsize} width={this.props.thumbsize} style={{ width: `${this.props.thumbsize}px`, height: `${this.props.thumbsize}px` }}/>
        <p>{this.props.name}</p>
        <input type="text" onChange={this.props.onChangeTags} value={this.props.tags}/>
      </div>
    );
  }
}

Upload.propTypes = {
  name: PropTypes.string.isRequired,
  bitmap: PropTypes.object.isRequired,
  tags: PropTypes.string.isRequired,
  thumbsize: PropTypes.number.isRequired,
  onChangeTags: PropTypes.func.isRequired,
};

export default connect(mapStateToProps)(Upload);
