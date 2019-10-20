import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import MediaList from "../components/MediaList";
import { searchMedia, saveSearch } from "../api/search";
import { deepEqual, bindAll } from "../utils/helpers";
import { setSearches } from "../utils/actions";

const mapDispatchToProps = (dispatch) => ({
  setSearches: (searches) => dispatch(setSearches(searches)),
});

class TagSearch extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      media: [],
    };

    bindAll(this, [
      "onSaveSearch",
    ]);
  }

  async updateList() {
    let media = await searchMedia({
      includeTags: this.props.includeTags,
      includeType: this.props.includeType || "and",
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

  async onSaveSearch() {
    let searches = await saveSearch(
      this.props.includeTags,
      this.props.includeType || "and",
      this.props.excludeTags,
    );

    this.props.setSearches(searches);
  }

  render() {
    return (
      <MediaList title={`Media tagged with ${this.props.includeTags.map(t => t.get("path")).join(", ")}`} onSaveSearch={this.onSaveSearch} media={this.state.media}/>
    );
  }
}

TagSearch.propTypes = {
  includeTags: PropTypes.arrayOf(PropTypes.object).isRequired,
  includeType: PropTypes.string,
  excludeTags: PropTypes.arrayOf(PropTypes.object).isRequired,
  setSearches: PropTypes.func.isRequired,
};

export default connect(null, mapDispatchToProps)(TagSearch);
