import React from "react";
import { PropTypes } from "prop-types";

import Media from "./Media";
import { bindAll } from "../utils/helpers";
import { If, Then, Else } from "../utils/Conditions";

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

  selectType(type) {
    this.setState({
      type,
    });
  }

  render() {
    let { media, share = null } = this.props;

    media = sort(media, (a, b) => {
      let diff = a.date.diff(b.date);
      if (this.state.sort == "descending") {
        return -diff;
      }
      return diff;
    });

    if (this.state.type) {
      media = media.filter(m => m.mimetype.startsWith(`${this.state.type}/`));
    }

    return (
      <div id="content" className="vertical">
        <div className="horizontal" style={{ justifyContent: "space-between" }}>
          <h2>
            {this.props.title}
            <If condition={!!this.props.onSaveSearch}>
              <Then>
                <sup onClick={this.props.onSaveSearch} style={{ cursor: "pointer", textDecoration: "underline", marginLeft: "5px" }}>Save Search</sup>
              </Then>
            </If>
          </h2>
          <div id="mediaSelector">
            <If condition={this.state.type == "image"}>
              <Then>
                <i onClick={() => this.selectType(null)} className="material-icons selected" title="Show all">photo</i>
              </Then>
              <Else>
                <i onClick={() => this.selectType("image")} className="material-icons" title="Show photos">photo</i>
              </Else>
            </If>
            <If condition={this.state.type == "video"}>
              <Then>
                <i onClick={() => this.selectType(null)} className="material-icons selected" title="Show all">movie</i>
              </Then>
              <Else>
                <i onClick={() => this.selectType("video")} className="material-icons" title="Show videos">movie</i>
              </Else>
            </If>
          </div>
          <label>Sort:
            <select style={{ marginLeft: "10px" }} onChange={this.onChangeSort} value={this.state.sort}>
              <option value="descending">Newest to oldest</option>
              <option value="ascending">Oldest to newest</option>
            </select>
          </label>
        </div>
        <div className="medialist">
          {media.map((media) => (
            <Media key={media.id} media={media} share={share}/>
          ))}
        </div>
      </div>
    );
  }
}

MediaList.propTypes = {
  title: PropTypes.string.isRequired,
  media: PropTypes.arrayOf(PropTypes.object).isRequired,
  share: PropTypes.string,
  onSaveSearch: PropTypes.func,
};

export default MediaList;
