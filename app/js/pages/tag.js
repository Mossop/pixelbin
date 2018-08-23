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

  async componentDidMount() {
    let media = await listMedia({
      includeTags: [this.props.tagId],
    });
    this.setState({
      media,
    });
  }

  render() {
    return (
      <div id="splitmain">
        <Sidebar/>
        <div id="content" className="vertical">
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
  tagId: PropTypes.number,
};

export default connect(mapStateToProps)(TagPage);
