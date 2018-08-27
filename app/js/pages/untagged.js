import React from "react";

import Sidebar from "../content/Sidebar";
import Media from "../content/Media";
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
        <div id="content" className="vertical">
          <div className="medialist">
            {this.state.media.map((media) => (
              <Media key={media.id} media={media}/>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

export default UntaggedPage;
