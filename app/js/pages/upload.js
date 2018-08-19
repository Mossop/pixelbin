import React from "react";
import { List, Map } from "immutable";
import moment from "moment";

import Sidebar from "../content/sidebar";
import Upload from "../content/upload";
import { bindAll } from "../utils/helpers";

const MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
];

const uuid = () => {
  return Math.random();
};

const itemIsMedia = (item) => {
  if (item.kind != "file") {
    return false;
  }

  return MEDIA_TYPES.includes(item.type);
};

export default class UploadPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      media: List(),
    };

    bindAll(this, [
      "onDragEnter",
      "onDragOver",
      "onDrop",
    ]);
  }

  onDragEnter(event) {
    let images = Array.from(event.dataTransfer.items).filter(itemIsMedia);
    if (images.length == 0) {
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.dropEffect = "copy";
    event.preventDefault();
  }

  onDragOver(event) {
    let images = Array.from(event.dataTransfer.items).filter(itemIsMedia);
    if (images.length == 0) {
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.dropEffect = "copy";
    event.preventDefault();
  }

  onDrop(event) {
    event.preventDefault();

    let files = Array.from(event.dataTransfer.items)
                     .filter(itemIsMedia)
                     .map(i => i.getAsFile());

    this.addFiles(files);
  }

  async addFiles(files) {
    let newMedia = [];
    let { parseMetadata } = await import(/* webpackChunkName: "metadata" */ "../metadata/parser");

    for (let file of files) {
      let media = {
        id: uuid(),
        file: file,
        bitmap: await createImageBitmap(file),
        tags: "",
        date: moment(file.lastModified),
      };

      let metadata = await parseMetadata(file);
      if ("hierarchicalTags" in metadata) {
        media.tags = metadata.hierarchicalTags.map(t => t.replace("|", "/")).join(", ");
      } else if ("tags" in metadata) {
        media.tags = metadata.tags.join(", ");
      }
      if ("date" in metadata) {
        media.date = metadata.date;
      }

      newMedia.push(Map(media));
    }

    this.setState({
      media: this.state.media.push(...newMedia),
    });
  }

  render() {
    return (
      <div id="splitmain">
        <Sidebar/>
        <div id="content" className="vertical">
          <div className="medialist" onDragEnter={this.onDragEnter} onDragOver={this.onDragOver} onDrop={this.onDrop}>
            {this.state.media.toArray().map((media) => (
              <Upload key={media.get("id")} name={media.get("file").name} bitmap={media.get("bitmap")} tags={media.get("tags")}/>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

Upload.propTypes = {};
