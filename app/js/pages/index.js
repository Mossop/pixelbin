import React from "react";

import { If, Then, Else } from "../utils/if";
import { loggedIn } from "../utils/helpers";
import Sidebar from "../content/sidebar";
import Media from "../content/media";
import { listMedia } from "../api/media";

class IndexPage extends React.Component {
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
      <If condition={loggedIn}>
        <Then>
          <div id="splitmain">
            <Sidebar/>
            <div id="content" className="vertical">
              <div className="medialist">
                {this.state.media.map((media) => (
                  <Media key={media.id} media={media}/>
                ))}
              </div>
            </div>
          </div>
        </Then>
        <Else>
          <div id="content">
          </div>
        </Else>
      </If>
    );
  }
}

export default IndexPage;
