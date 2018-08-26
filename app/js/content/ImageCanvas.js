import React from "react";
import PropTypes from "prop-types";

class ImageCanvas extends React.Component {
  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
  }

  drawBitmap(bitmap, canvas) {
    let size = canvas.height;
    let width = bitmap.width;
    let height = bitmap.height;
    if (width > height) {
      width = size;
      height = bitmap.height / (bitmap.width / width);
    } else {
      height = size;
      width = bitmap.width / (bitmap.height / height);
    }

    let context = canvas.getContext("2d");
    context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  }

  async componentDidMount() {
    if (this.props.bitmap) {
      this.drawBitmap(this.props.bitmap, this.canvasRef.current);
    }
  }

  async componentDidUpdate(prevProps) {
    if (!this.props.bitmap || this.props.bitmap == prevProps.bitmap) {
      return;
    }

    this.drawBitmap(this.props.bitmap, this.canvasRef.current);
  }

  render() {
    let { size } = this.props;
    return (
      <canvas ref={this.canvasRef} height={size} width={size} style={{ width: size, height: size }}/>
    );
  }
}

ImageCanvas.propTypes = {
  bitmap: PropTypes.object,
  size: PropTypes.number.isRequired,
};

export default ImageCanvas;
