import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

const mapStateToProps = (state) => ({
  thumbsize: 150,
});

class Upload extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tags: "",
    };

    this.canvasRef = React.createRef();
  }

  async componentDidMount() {
    let bitmap = await createImageBitmap(this.props.file);

    if (!this.canvasRef.current) {
      return;
    }

    let size = this.props.thumbsize;
    let width = bitmap.width;
    let height = bitmap.height;
    if (width > height) {
      width = size;
      height = bitmap.height / (bitmap.width / width);
    } else {
      height = size;
      width = bitmap.width / (bitmap.height / height);
    }

    let context = this.canvasRef.current.getContext("2d");
    context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  }

  render() {
    return (
      <div className="media">
        <canvas ref={this.canvasRef} height={this.props.thumbsize} width={this.props.thumbsize} style={{ width: `${this.props.thumbsize}px`, height: `${this.props.thumbsize}px` }}/>
        <p>{this.props.file.name}</p>
        <input type="text" disabled="true" value={this.state.tags}/>
      </div>
    );
  }
}

Upload.propTypes = {
  file: PropTypes.object.isRequired,
  thumbsize: PropTypes.number.isRequired,
};

export default connect(mapStateToProps)(Upload);
