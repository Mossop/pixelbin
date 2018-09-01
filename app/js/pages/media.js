import React from "react";
import PropTypes from "prop-types";

import { loadMetadata, buildDownloadURL } from "../api/media";
import { bindAll } from "../utils/helpers";
import Throbber from "../content/Throbber";

const isImage = (metadata) => metadata.mimetype.startsWith("image/");

const ImageMediaDisplay = ({ metadata }) => {
  return (
    <img id="media" src={buildDownloadURL(metadata)}/>
  );
};

ImageMediaDisplay.propTypes = {
  metadata: PropTypes.object.isRequired,
};

const VideoMediaDisplay = ({ metadata }) => {
  return (
    <video id="media" src={buildDownloadURL(metadata)} controls="true" autoPlay="true"/>
  );
};

VideoMediaDisplay.propTypes = {
  metadata: PropTypes.object.isRequired,
};

const MediaDisplay = ({ metadata }) => {
  if (isImage(metadata)) {
    return <ImageMediaDisplay metadata={metadata}/>;
  }
  return <VideoMediaDisplay metadata={metadata}/>;
};

MediaDisplay.propTypes = {
  metadata: PropTypes.object.isRequired,
};

class MediaContainer extends React.Component {
  constructor(props) {
    super(props);
    this.displayLeft = 0;
    this.displayTop = 0;
    this.displayHeight = 0;
    this.displayWidth = 0;

    bindAll(this, [
      "componentDidResize",
    ]);

    this.containerRef = React.createRef();
    this.displayRef = React.createRef();
  }

  componentDidResize() {
    let { width: containerWidth, height: containerHeight } = this.containerRef.current.getBoundingClientRect();
    let containerAspect = containerWidth / containerHeight;
    let mediaAspect = this.props.metadata.width / this.props.metadata.height;

    if (this.props.metadata.width < containerWidth && this.props.metadata.height < containerHeight) {
      this.displayHeight = this.props.metadata.height;
      this.displayWidth = this.props.metadata.width;
    } else if (containerAspect > mediaAspect) {
      this.displayHeight = containerHeight;
      this.displayWidth = mediaAspect * containerHeight;
    } else {
      this.displayWidth = containerWidth;
      this.displayHeight = containerWidth / mediaAspect;
    }

    this.displayTop = (containerHeight - this.displayHeight) / 2;
    this.displayLeft = (containerWidth - this.displayWidth) / 2;

    let style = this.displayRef.current.style;
    style.top = `${this.displayTop}px`;
    style.left = `${this.displayLeft}px`;
    style.width = `${this.displayWidth}px`;
    style.height = `${this.displayHeight}px`;
    console.log(style, this.displayTop, this.displayLeft);
  }

  componentDidMount() {
    window.addEventListener("resize", this.componentDidResize);
    this.componentDidResize();
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.componentDidResize);
  }

  render() {
    return (
      <div id="mediaContainer" ref={this.containerRef} >
        <div id="mediaDisplay" ref={this.displayRef} style={{
          top: this.displayTop,
          left: this.displayLeft,
          width: this.displayWidth,
          height: this.displayHeight,
        }}>
          <MediaDisplay metadata={this.props.metadata}/>
        </div>
      </div>
    );
  }
}

MediaContainer.propTypes = {
  metadata: PropTypes.object.isRequired,
};

class MediaPage extends React.Component {
  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
    this.state = {
      metadata: null,
    };
  }

  async componentDidMount() {
    let mediaId = this.props.match.params.id;
    let metadata = await loadMetadata(mediaId);
    this.setState({
      metadata,
    });
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.bitmap && this.state.bitmap != prevState.bitmap) {
      this.drawBitmap(this.state.bitmap, this.canvasRef.current);
    }
  }

  render() {
    if (this.state.metadata) {
      return (
        <div id="content" className="horizontal">
          <MediaContainer metadata={this.state.metadata}/>
        </div>
      );
    }
    return (
      <div id="content" className="horizontal">
        <Throbber style={{ flex: 1 }}/>
      </div>
    );
  }
}

MediaPage.propTypes = {
  match: PropTypes.object.isRequired,
};

export default MediaPage;
