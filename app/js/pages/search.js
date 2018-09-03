import React from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";

import Sidebar from "../content/Sidebar";
import TagSearch from "../content/TagSearch";
import { tagFromPath } from "../utils/helpers";

const mapStateToProps = (state, props) => {
  let newProps = {
    includeTags: [],
    includeType: "and",
    excludeTags: [],
  };

  let params = new URLSearchParams(props.location.search);
  for (let [key, value] of params) {
    if (key == "includeTag") {
      newProps.includeTags.push(tagFromPath(state, value));
    } else if (key == "excludeTag") {
      newProps.excludeTags.push(tagFromPath(state, value));
    } else if (key == "includeType") {
      if (value == "or") {
        newProps["includeType"] = "or";
      }
    }
  }

  return newProps;
};

const SearchPage = ({ includeTags, excludeTags }) => {
  return (
    <div id="splitmain">
      <Sidebar selectedTags={includeTags}/>
      <TagSearch includeTags={includeTags} excludeTags={excludeTags}/>
    </div>
  );
};

SearchPage.propTypes = {
  includeTags: PropTypes.arrayOf(PropTypes.object).isRequired,
  includeType: PropTypes.string.isRequired,
  excludeTags: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default connect(mapStateToProps)(SearchPage);
