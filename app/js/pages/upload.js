import React from "react";

import Sidebar from "../content/sidebar";
import Upload from "../content/upload";
import { bindAll } from "../utils/helpers";

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
];

const uuid = () => {
  return Math.random();
};

const itemIsImage = (item) => {
  if (item.kind != "file") {
    return false;
  }

  return IMAGE_TYPES.includes(item.type);
};

export default class UploadPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      media: [],
    };

    bindAll(this, [
      "onDragEnter",
      "onDragOver",
      "onDrop",
    ]);
  }

  onDragEnter(event) {
    let images = Array.from(event.dataTransfer.items).filter(itemIsImage);
    if (images.length == 0) {
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.dropEffect = "copy";
    event.preventDefault();
  }

  onDragOver(event) {
    let images = Array.from(event.dataTransfer.items).filter(itemIsImage);
    if (images.length == 0) {
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.dropEffect = "copy";
    event.preventDefault();
  }

  onDrop(event) {
    event.preventDefault();

    let images = Array.from(event.dataTransfer.items)
                      .filter(itemIsImage)
                      .map(i => ({ id: uuid(), file: i.getAsFile() }));

    this.setState({ media: this.state.media.concat(images) });
  }

  render() {
    return (
      <div id="splitmain">
        <Sidebar/>
        <div id="content" className="vertical">
          <div className="medialist" onDragEnter={this.onDragEnter} onDragOver={this.onDragOver} onDrop={this.onDrop}>
            {this.state.media.map((media) => (
              <Upload key={media.id} file={media.file}/>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

Upload.propTypes = {};
