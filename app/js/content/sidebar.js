import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";

import { If, Then } from "../utils/if";

const TagList = ({ parent, tags }) => {
  return (
    <ol>
      <If condition={parent == ""}>
        <Then>
          <li><Link to="/">All Media</Link></li>
          <li><Link to="/untagged">Untagged Media</Link></li>
        </Then>
      </If>
      {tags.map(t => (
        <li key={t.id}>
          <Link to={`/tag/${parent}${t.name}`}>{t.name}</Link>
          <If condition={t.children.length > 0}>
            <Then>
              <TagList parent={`${parent}${t.name}/`} tags={t.children}/>
            </Then>
          </If>
        </li>
      ))}
    </ol>
  );
};

TagList.propTypes = {
  parent: PropTypes.string.isRequired,
  tags: PropTypes.arrayOf(PropTypes.object).isRequired,
};

const mapStateToProps = (state) => ({
  tags: state.get("tags").toJS(),
});

const Sidebar = ({ tags }) => {
  return (
    <div id="sidebar">
      <TagList parent="" tags={tags}/>
    </div>
  );
};

Sidebar.propTypes = {
  tags: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default connect(mapStateToProps)(Sidebar);
