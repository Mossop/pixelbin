import React from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";

import Sidebar from "../content/Sidebar";
import Media from "../content/Media";
import { tagFromPath } from "../utils/helpers";
import { listMedia } from "../api/media";

const mapStateToProps = (state, props) => {
  let newProps = {
    includeTags: [],
    excludeTags: [],
  };

  let params = new URLSearchParams(props.location.search);
  for (let [key, value] of params) {
    if (key == "includeTag") {
      newProps.includeTags.push(tagFromPath(state, value));
    } else if (key == "excludeTag") {
      newProps.excludeTags.push(tagFromPath(state, value));
    }
  }

  return newProps;
};

class SearchPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      media: [],
    };
  }

  async updateList() {
    let media = await listMedia({
      includeTags: this.props.includeTags,
      excludeTags: this.props.excludeTags,
    });
    this.setState({
      media,
    });
  }

  componentDidMount() {
    this.updateList();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.includeTags.length != this.props.includeTags.length &&
        prevProps.excludeTags.length != this.props.excludeTags.length) {
      this.updateList();
    }
  }

  render() {
    return (
      <div id="splitmain">
        <Sidebar selectedTags={this.props.includeTags}/>
        <div id="content" className="vertical">
          <div className="horizontal" style={{ justifyContent: "space-between" }}>
            <h2>Media tagged with {this.props.includeTags.map(t => t.get("path")).join(", ")}</h2>
            <label>Sort
              <select>
                <option>Newest to oldest</option>
                <option>Oldest to newest</option>
              </select>
            </label>
          </div>
          <div className="medialist">
            {this.state.media.map((media) => (
              <Media key={media.id} media={media}/>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

SearchPage.propTypes = {
  includeTags: PropTypes.arrayOf(PropTypes.object).isRequired,
  excludeTags: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default connect(mapStateToProps)(SearchPage);
