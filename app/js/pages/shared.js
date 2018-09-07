import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import MediaList from "../content/MediaList";
import Sidebar from "../content/Sidebar";
import { fetchTagSearch } from "../api/search";
import { loggedIn } from "../utils/helpers";

const mapStateToProps = (state) => ({
  loggedIn: loggedIn(state),
});

class SharedPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: "",
      media: [],
    };
  }

  async updateList() {
    let { name, media } = await fetchTagSearch(this.props.match.params.id);
    this.setState({
      name,
      media,
    });
  }

  async componentDidMount() {
    this.updateList();
  }

  componentDidUpdate(prevProps) {
    if (this.props.match.params.id != prevProps.match.params.id) {
      this.updateList();
    }
  }

  render() {
    if (this.props.loggedIn) {
      return (
        <div id="splitmain">
          <Sidebar selectedSearch={this.props.match.params.id}/>
          <div id="content">
            <MediaList title={this.state.name} media={this.state.media}/>
          </div>
        </div>
      );
    }

    return (
      <div id="content">
        <MediaList title={this.state.name} media={this.state.media}/>
      </div>
    );
  }
}

SharedPage.propTypes = {
  loggedIn: PropTypes.bool.isRequired,
  match: PropTypes.object.isRequired,
};

export default connect(mapStateToProps)(SharedPage);
