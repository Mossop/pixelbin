import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import { buildThumbURL } from "../api/media";
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

  render() {
    let { thumbsize } = this.props;
    let { bitmap } = this.state;
    return (
      <div className="media">
        <ImageCanvas bitmap={bitmap} size={thumbsize}/>
      </div>
    );
  }
}

Media.propTypes = {
  thumbsize: PropTypes.number.isRequired,
  media: PropTypes.object.isRequired,
};

export default connect(mapStateToProps)(Media);
