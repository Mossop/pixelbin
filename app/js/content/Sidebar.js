import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";

import { If, Then } from "../utils/if";

const TagList = ({ parent, tags, depth = 0, selectedTags, untagged = false, all = false }) => {
  return (
    <ol>
      <If condition={parent == ""}>
        <Then>
          <li className={all ? "selected" : ""} style={{ paddingLeft: `${depth * 10}px` }}><Link to="/">All Media</Link></li>
          <li className={untagged ? "selected" : ""} style={{ paddingLeft: `${depth * 10}px` }}><Link to="/untagged">Untagged Media</Link></li>
        </Then>
      </If>
      {tags.map(t => (
        <li key={t.id} style={{ paddingLeft: `${depth * 10}px` }} className={selectedTags.includes(t.path) ? "selected" : ""}>
          <Link to={`/tag/${parent}${t.name}`}>{t.name}</Link>
          <If condition={t.children.length > 0}>
            <Then>
              <TagList parent={`${parent}${t.name}/`} tags={t.children} depth={depth + 1} selectedTags={selectedTags}/>
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
  selectedTags: PropTypes.arrayOf(PropTypes.string).isRequired,
  depth: PropTypes.number,
  all: PropTypes.bool,
  untagged: PropTypes.bool,
};

const mapStateToProps = (state) => ({
  tags: state.get("tags").toJS(),
});

const Sidebar = ({ tags, selectedTags, untagged = false, all = false }) => {
  return (
    <div id="sidebar">
      <TagList parent="" tags={tags} selectedTags={selectedTags} untagged={untagged} all={all}/>
    </div>
  );
};

Sidebar.propTypes = {
  tags: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedTags: PropTypes.arrayOf(PropTypes.string).isRequired,
  all: PropTypes.bool,
  untagged: PropTypes.bool,
};

export default connect(mapStateToProps)(Sidebar);
