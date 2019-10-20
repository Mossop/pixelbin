import React from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";

import Sidebar from "../components/Sidebar";
import TagSearch from "../components/TagSearch";
import { tagFromPath } from "../utils/helpers";

const mapStateToProps = (state, props) => ({
  tag: tagFromPath(state, props.match.params.tag),
});

const TagPage = ({ tag }) => {
  return (
    <div id="splitmain">
      <Sidebar selectedTags={[tag]}/>
      <TagSearch includeTags={[tag]} excludeTags={[]}/>
    </div>
  );
};

TagPage.propTypes = {
  match: PropTypes.object.isRequired,
  tag: PropTypes.object.isRequired,
};

export default connect(mapStateToProps)(TagPage);
