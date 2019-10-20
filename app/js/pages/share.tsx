import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import MediaList from "../components/MediaList";
import Sidebar from "../components/Sidebar";
import { fetchShare } from "../api/search";
import { isLoggedIn } from "../utils/helpers";

const mapStateToProps = (state) => ({
  loggedIn: isLoggedIn(state),
});

class SharePage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: "",
      media: [],
    };
  }

  async updateList() {
    let { name, media } = await fetchShare(this.props.match.params.share);
    this.setState({
      name,
      media,
    });
  }

  async componentDidMount() {
    this.updateList();
  }

  componentDidUpdate(prevProps) {
    if (this.props.match.params.share != prevProps.match.params.share) {
      this.updateList();
    }
  }

  render() {
    if (this.props.loggedIn) {
      return (
        <div id="splitmain">
          <Sidebar selectedShare={this.props.match.params.share}/>
          <div id="content">
            <MediaList title={this.state.name} media={this.state.media}/>
          </div>
        </div>
      );
    }

    return (
      <div id="content">
        <MediaList title={this.state.name} media={this.state.media} share={this.props.match.params.share}/>
      </div>
    );
  }
}

SharePage.propTypes = {
  loggedIn: PropTypes.bool.isRequired,
  match: PropTypes.object.isRequired,
};

export default connect(mapStateToProps)(SharePage);
