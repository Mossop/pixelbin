import React from "react";
import { PropTypes } from "prop-types";

import Media from "./Media";
import { bindAll } from "../utils/helpers";

function sort(arr, cmp) {
  arr = arr.slice(0);
  arr.sort(cmp);
  return arr;
}

class MediaList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sort: "descending",
    };

    bindAll(this, [
      "onChangeSort",
    ]);
  }

  onChangeSort(event) {
    this.setState({
      sort: event.target.value,
    });
  }

  render() {
    let media = this.props.media;
    media = sort(media, (a, b) => {
      let diff = a.date.diff(b.date);
      if (this.state.sort == "descending") {
        return -diff;
      }
      return diff;
    });

    return (
      <div id="content" className="vertical">
        <div className="horizontal" style={{ justifyContent: "space-between" }}>
          <h2>{this.props.title}</h2>
          <label>Sort:
            <select style={{ marginLeft: "10px" }} onChange={this.onChangeSort} value={this.state.sort}>
              <option value="descending">Newest to oldest</option>
              <option value="ascending">Oldest to newest</option>
            </select>
          </label>
        </div>
        <div className="medialist">
          {media.map((media) => (
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
