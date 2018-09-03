import React from "react";
import PropTypes from "prop-types";

import MediaList from "../content/MediaList";
import { fetchTagSearch } from "../api/search";

class SharedPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      media: [],
    };
  }

  async componentDidMount() {
    let { name, media } = await fetchTagSearch(this.props.match.params.id);
    this.setState({
      name,
      media,
    });
  }

  render() {
    return (
      <div id="content">
        <MediaList title={this.state.name} media={this.state.media}/>
      </div>
    );
  }
}

SharedPage.propTypes = {
  match: PropTypes.object.isRequired,
};

export default SharedPage;
