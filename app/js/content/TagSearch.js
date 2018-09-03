import React from "react";
import PropTypes from "prop-types";

import MediaList from "../content/MediaList";
import { listMedia } from "../api/media";
import { deepEqual } from "../utils/helpers";

class TagSearch extends React.Component {
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
    if (!deepEqual(prevProps.includeTags, this.props.includeTags) ||
        !deepEqual(prevProps.excludeTags, this.props.excludeTags)) {
      this.updateList();
    }
  }

  render() {
    return (
      <MediaList title={`Media tagged with ${this.props.includeTags.map(t => t.get("path")).join(", ")}`} media={this.state.media}/>
    );
  }
}

TagSearch.propTypes = {
  includeTags: PropTypes.arrayOf(PropTypes.object).isRequired,
  excludeTags: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default TagSearch;
