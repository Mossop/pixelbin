import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

const mapStateToProps = () => ({
  thumbsize: 150,
});

class Upload extends React.Component {
  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
  }

  drawThumbnail() {
    let size = this.props.thumbsize;
    let width = this.props.bitmap.width;
    let height = this.props.bitmap.height;
    if (width > height) {
      width = size;
      height = this.props.bitmap.height / (this.props.bitmap.width / width);
    } else {
      height = size;
      width = this.props.bitmap.width / (this.props.bitmap.height / height);
    }

    let context = this.canvasRef.current.getContext("2d");
    context.drawImage(this.props.bitmap, (size - width) / 2, (size - height) / 2, width, height);
  }

  componentDidMount() {
    this.drawThumbnail();
  }

  render() {
    return (
      <div className="media">
        <canvas ref={this.canvasRef} height={this.props.thumbsize} width={this.props.thumbsize} style={{ width: `${this.props.thumbsize}px`, height: `${this.props.thumbsize}px` }}/>
        <p>{this.props.name}</p>
        <input type="text" value={this.props.tags}/>
      </div>
    );
  }
}

Upload.propTypes = {
  name: PropTypes.string.isRequired,
  bitmap: PropTypes.object.isRequired,
  tags: PropTypes.string.isRequired,
  thumbsize: PropTypes.number.isRequired,
};

export default connect(mapStateToProps)(Upload);
