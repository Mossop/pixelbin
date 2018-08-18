import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

const mapStateToProps = () => ({
  thumbsize: 150,
});

class Upload extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tags: "",
      date: new Date(props.file.lastModified),
    };

    this.canvasRef = React.createRef();
    this.mounted = false;
  }

  async createThumbnail() {
    let bitmap = await createImageBitmap(this.props.file);

    if (!this.mounted) {
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

  async extractMetadata() {
    let { parseMetadata } = await import(/* webpackChunkName: "metadata" */ "../metadata/parser");
    let metadata = await parseMetadata(this.props.file);
    console.log(metadata);

    if (!this.mounted) {
      return;
    }

    let newState = {};
    if ("tags" in metadata) {
      newState.tags = metadata.tags;
    }
    if ("date" in metadata) {
      newState.date = metadata.date;
    }

    this.setState(newState);
  }

  componentDidMount() {
    this.mounted = true;

    this.createThumbnail();
    this.extractMetadata();
  }

  componentWillUnmount() {
    this.mounted = false;
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
