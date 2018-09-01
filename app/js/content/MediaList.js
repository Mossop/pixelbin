import React from "react";
import { PropTypes } from "prop-types";

import Media from "./Media";

class MediaList extends React.Component {
  render() {
    return (
      <div id="content" className="vertical">
        <div className="horizontal" style={{ justifyContent: "space-between" }}>
          <h2>{this.props.title}</h2>
          <label>Sort:
            <select>
              <option>Newest to oldest</option>
              <option>Oldest to newest</option>
            </select>
          </label>
        </div>
        <div className="medialist">
          {this.props.media.map((media) => (
            <Media key={media.id} media={media}/>
          ))}
        </div>
      </div>
    );
  }
}

MediaList.propTypes = {
  title: PropTypes.string.isRequired,
  media: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default MediaList;
