import React from "react";

import Sidebar from "../components/Sidebar";
import MediaList from "../components/MediaList";
import { listUntaggedMedia } from "../api/media";

class UntaggedPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      media: [],
    };
  }

  async componentDidMount() {
    let media = await listUntaggedMedia();
    this.setState({
      media,
    });
  }

  render() {
    return (
      <div id="splitmain">
        <Sidebar selectedTags={[]} untagged={true}/>
        <MediaList title="Untagged media" media={this.state.media}/>
      </div>
    );
  }
}

export default UntaggedPage;
