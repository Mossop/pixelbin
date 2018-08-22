import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import { If, Then, Else } from "../utils/if";

const TagList = ({ parent, tags }) => {
  return (
    <ol>
      <If condition={!!parent}>
        <Else>
          <li>All Media</li>
          <li>Untagged Media</li>
        </Else>
      </If>
      {tags.map(t => (
        <li key={t.id}>
          {t.name}
          <If condition={t.children.length > 0}>
            <Then>
              <TagList parent={t.id} tags={t.children}/>
            </Then>
          </If>
        </li>
      ))}
    </ol>
  );
};

TagList.propTypes = {
  parent: PropTypes.number,
  tags: PropTypes.arrayOf(PropTypes.object).isRequired,
};

const mapStateToProps = (state) => ({
  tags: state.get("tags").toJS(),
});

const Sidebar = ({ tags }) => {
  return (
    <div id="sidebar">
      <TagList tags={tags}/>
    </div>
  );
};

Sidebar.propTypes = {
  tags: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default connect(mapStateToProps)(Sidebar);
