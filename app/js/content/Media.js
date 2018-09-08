import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";

import { buildThumbURL } from "../api/media";
import { bindAll } from "../utils/helpers";
import ImageCanvas from "./ImageCanvas";

const mapStateToProps = () => ({
  thumbsize: 150,
});

class Media extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      bitmap: null,
    };

    bindAll(this, [
      "openMedia",
    ]);
  }

  async componentDidMount() {
    let thumburl = buildThumbURL(this.props.media, this.props.thumbsize, this.props.share);

    let response = await fetch(thumburl);
    if (response.ok) {
      let blob = await response.blob();
      let bitmap = await createImageBitmap(blob);
      this.setState({
        bitmap,
      });
    }
  }

  openMedia() {
    console.log(1);
    if (this.props.share) {
      this.props.history.push(`/share/${this.props.share}/media/${this.props.media.id}`);
    } else {
      this.props.history.push(`/media/${this.props.media.id}`);
    }
  }

  render() {
    let { thumbsize } = this.props;
    let { bitmap } = this.state;
    return (
      <div className="media">
        <ImageCanvas bitmap={bitmap} size={thumbsize} onClick={this.openMedia}/>
      </div>
    );
  }
}

Media.propTypes = {
  thumbsize: PropTypes.number.isRequired,
  media: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  share: PropTypes.string,
};

export default withRouter(connect(mapStateToProps)(Media));
