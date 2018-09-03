import React from "react";

import { If, Then, Else } from "../utils/if";
import { loggedIn } from "../utils/helpers";
import Sidebar from "../content/Sidebar";
import MediaList from "../content/MediaList";
import { searchMedia } from "../api/search";

class MainContent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      media: [],
    };
  }

  async componentDidMount() {
    let media = await searchMedia();
    this.setState({
      media,
    });
  }

  render() {
    return (
      <MediaList title="All media" media={this.state.media}/>
    );
  }
}

const IndexPage = () => {
  return (
    <If condition={loggedIn}>
      <Then>
        <div id="splitmain">
          <Sidebar selectedTags={[]} all={true}/>
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
