import React from "react";
import PropTypes from "prop-types";

import { loadMetadata, buildDownloadURL } from "../api/media";
import { bindAll } from "../utils/helpers";
import Throbber from "../content/Throbber";

/* global promiseMapsAPI, google */

const isImage = (metadata) => metadata.mimetype.startsWith("image/");

const ImageMediaDisplay = ({ metadata, share }) => {
  return (
    <img id="media" src={buildDownloadURL(metadata, share)}/>
  );
};

ImageMediaDisplay.propTypes = {
  metadata: PropTypes.object.isRequired,
  share: PropTypes.string,
};

const VideoMediaDisplay = ({ metadata, share }) => {
  return (
    <video id="media" src={buildDownloadURL(metadata, share)} controls="true" autoPlay="true"/>
  );
};

VideoMediaDisplay.propTypes = {
  metadata: PropTypes.object.isRequired,
  share: PropTypes.string,
};

const MediaDisplay = ({ metadata, share }) => {
  if (isImage(metadata)) {
    return <ImageMediaDisplay metadata={metadata} share={share}/>;
  }
  return <VideoMediaDisplay metadata={metadata} share={share}/>;
};

MediaDisplay.propTypes = {
  metadata: PropTypes.object.isRequired,
  share: PropTypes.string,
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
    this.mapRef = React.createRef();
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
  }

  async componentDidMount() {
    window.addEventListener("resize", this.componentDidResize);
    this.componentDidResize();

    await promiseMapsAPI();

    let latlng = {
      lat: this.props.metadata.latitude,
      lng: this.props.metadata.longitude,
    };

    let map = new google.maps.Map(this.mapRef.current, {
      center: latlng,
      zoom: 10,
      fullscreenControl: false,
    });

    new google.maps.Marker({
      position: latlng,
      map,
    });
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.componentDidResize);
  }

  render() {
    return (
      <React.Fragment>
        <div id="mediaContainer" ref={this.containerRef} >
          <div id="mediaDisplay" ref={this.displayRef} style={{
            top: this.displayTop,
            left: this.displayLeft,
            width: this.displayWidth,
            height: this.displayHeight,
          }}>
            <MediaDisplay metadata={this.props.metadata} share={this.props.share}/>
          </div>
        </div>
        <div id="metadataDisplay">
          <div id="mapDisplay" ref={this.mapRef}/>
          <div id="metadataGrid">
            <div className="fieldGrid">
              <p className="rightAlign">Date:</p>
              <p>{this.props.metadata.date.format("HH:mm Mo MMM YYYY")}</p>
              <p className="rightAlign">Tags:</p>
              <p>{this.props.metadata.tags.join(", ")}</p>
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  }
}

MediaContainer.propTypes = {
  metadata: PropTypes.object.isRequired,
  share: PropTypes.string,
};

class MediaPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      metadata: null,
    };
  }

  async componentDidMount() {
    let { id, share = null } = this.props.match.params;
    let metadata = await loadMetadata(id, share);
    this.setState({
      metadata,
    });
  }

  render() {
    if (this.state.metadata) {
      return (
        <div id="content" className="horizontal">
          <MediaContainer metadata={this.state.metadata} share={this.props.match.params.share}/>
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
