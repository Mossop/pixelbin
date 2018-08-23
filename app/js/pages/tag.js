import React from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";

import Sidebar from "../content/sidebar";
import Media from "../content/media";
import { tagIDFromPath } from "../utils/helpers";
import { listMedia } from "../api/media";

const mapStateToProps = (state, props) => ({
  tagId: tagIDFromPath(state, props.match.params.tag),
});

class TagPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      media: [],
    };
  }

  async updateList() {
    let media = await listMedia({
      includeTags: [this.props.tagId],
    });
    this.setState({
      media,
    });
  }

  componentDidMount() {
    this.updateList();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.tagId != this.props.tagId) {
      this.updateList();
    }
  }

  render() {
    return (
      <div id="splitmain">
        <Sidebar/>
        <div id="content" className="vertical">
          <div className="horizontal" style={{ justifyContent: "space-between" }}>
            <h2>Media tagged with {this.props.match.params.tag}</h2>
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

TagPage.propTypes = {
  match: PropTypes.object.isRequired,
  tagId: PropTypes.number,
};

export default connect(mapStateToProps)(TagPage);
