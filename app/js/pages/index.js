import React from "react";

import { If, Then, Else } from "../utils/if";
import { loggedIn } from "../utils/helpers";
import Sidebar from "../content/Sidebar";
import Media from "../content/Media";
import { listMedia } from "../api/media";

class MainContent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      media: [],
    };
  }

  async componentDidMount() {
    let media = await listMedia();
    this.setState({
      media,
    });
  }

  render() {
    return (
      <div id="content" className="vertical">
        <div className="medialist">
          {this.state.media.map((media) => (
            <Media key={media.id} media={media}/>
          ))}
        </div>
      </div>
    );
  }
}

const IndexPage = () => {
  return (
    <If condition={loggedIn}>
      <Then>
        <div id="splitmain">
          <Sidebar/>
          <MainContent/>
        </div>
      </Then>
      <Else>
        <div id="content">
        </div>
      </Else>
    </If>
  );
};

export default IndexPage;
