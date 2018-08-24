import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import { buildThumbURL } from "../api/media";
import { drawBitmapToCanvas } from "../utils/helpers";

const mapStateToProps = () => ({
  thumbsize: 150,
});

class Media extends React.Component {
  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
    this.state = {
      bitmap: null,
    };
  }

  async componentDidMount() {
    let thumburl = buildThumbURL(this.props.media.id, this.props.thumbsize);

    let response = await fetch(thumburl);
    if (response.ok) {
      let blob = await response.blob();
      let bitmap = await createImageBitmap(blob);
      this.setState({
        bitmap,
      });
    }
  }

  async componentDidUpdate(prevProps, prevState) {
    if (!this.state.bitmap || this.state.bitmap == prevState.bitmap) {
      return;
    }

    drawBitmapToCanvas(this.state.bitmap, this.canvasRef.current);
  }

  render() {
    let { thumbsize } = this.props;
    return (
      <div className="media">
        <canvas ref={this.canvasRef} height={thumbsize} width={thumbsize} style={{ width: thumbsize, height: thumbsize }}/>
      </div>
    );
  }
}

Media.propTypes = {
  thumbsize: PropTypes.number.isRequired,
  media: PropTypes.object.isRequired,
};

export default connect(mapStateToProps)(Media);
