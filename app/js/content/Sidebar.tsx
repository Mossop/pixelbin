import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link, withRouter } from "react-router-dom";

import { If, Then } from "../utils/Conditions";
import { bindAll } from "../utils/helpers";

const TagLink = withRouter(({ tag, history, selectedTags, children }) => {
  let link = `/tag/${tag.path}`;
  let appendTag = (event) => {
    event.preventDefault();

    if (event.metaKey) {
      let params = new URLSearchParams();
      for (let t of selectedTags) {
        params.append("includeTag", t.get("path"));
      }
      params.append("includeTag", tag.path);
      history.push(`/search?${params}`);
    } else {
      history.push(link);
    }
  };

  return (
    <a onClick={appendTag} href={link}>{children}</a>
  );
});

function isIncluded(tag, searchTerm) {
  if (tag.name.toLowerCase().indexOf(searchTerm) >= 0) {
    return true;
  }

  return tag.children.filter(t => isIncluded(t, searchTerm)).length > 0;
}

const TagList = ({ parent, tags, depth = 0, selectedTags, searchTerm }) => {
  if (searchTerm) {
    tags = tags.filter(t => isIncluded(t, searchTerm));
  }

  return (
    <ol>
      {tags.map(t => (
        <li key={t.id} className={selectedTags.map(t => t.get("path")).includes(t.path) ? "selected" : ""}>
          <span style={{ paddingLeft: `${(depth + 1) * 10}px`, paddingRight: "10px" }}><TagLink tag={t} selectedTags={selectedTags}>{t.name}</TagLink></span>
          <If condition={t.children.length > 0}>
            <Then>
              <TagList parent={`${parent}${t.name}/`} tags={t.children} depth={depth + 1} selectedTags={selectedTags} searchTerm={searchTerm}/>
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
  selectedTags: PropTypes.arrayOf(PropTypes.object).isRequired,
  searchTerm: PropTypes.string.isRequired,
  depth: PropTypes.number,
};

const mapStateToProps = (state) => ({
  tags: state.get("tags").toJS(),
  searches: state.get("searches").toJS(),
});

class Sidebar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchTerm: "",
    };

    bindAll(this, [
      "onChangeSearchTerm",
    ]);
  }

  onChangeSearchTerm(event) {
    this.setState({
      searchTerm: event.target.value,
    });
  }

  render() {
    let { tags, selectedTags = [], selectedSearch = "", untagged = false, all = false, searches } = this.props;
    return (
      <div id="sidebar">
        <ol>
          <li className={all ? "selected" : ""}><span style={{ paddingLeft: "10px" }}><Link to="/">All Media</Link></span></li>
          <li className={untagged ? "selected" : ""}><span style={{ paddingLeft: "10px" }}><Link to="/untagged">Untagged Media</Link></span></li>
        </ol>
        <div className="tagsearch">
          <input type="text" onChange={this.onChangeSearchTerm} value={this.state.searchTerm} placeholder="Filter tags"/>
        </div>
        <TagList parent="" tags={tags} selectedTags={selectedTags} searchTerm={this.state.searchTerm.toLowerCase()}/>
        <If condition={searches.length > 0}>
          <Then>
            <div id="searches">
              <h3>Searches</h3>
              <ol>
                {searches.map(s => (
                  <li key={s.id} className={s.id == selectedSearch ? "selected" : ""}><Link to={`/share/${s.id}`}>{s.name}</Link></li>
                ))}
              </ol>
            </div>
          </Then>
        </If>
      </div>
    );
  }
}

Sidebar.propTypes = {
  tags: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedTags: PropTypes.arrayOf(PropTypes.object),
  selectedSearch: PropTypes.string,
  all: PropTypes.bool,
  untagged: PropTypes.bool,
  searches: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default connect(mapStateToProps)(Sidebar);
