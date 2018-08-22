import React from "react";
import { List, Map } from "immutable";
import moment from "moment";

import Sidebar from "../content/sidebar";
import Upload from "../content/upload";
import { bindAll } from "../utils/helpers";
import { If, Then, Else } from "../utils/if";
import { upload } from "../api/image";

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
      globalTags: "",
    };

    bindAll(this, [
      "onDragEnter",
      "onDragOver",
      "onDrop",
      "onGlobalTagsChange",
      "onUpload",
      "hasMedia",
    ]);
  }

  hasMedia() {
    return this.state.media.size > 0;
  }

  async onUpload() {
    let globalTags = this.state.globalTags;
    let allMedia = this.state.media;

    for (let pos = 0; pos < allMedia.size;) {
      let media = allMedia.get(pos);
      let tags = `${globalTags}, ${media.get("tags")}`;

      try {
        let result = await upload(media.get("file"), tags, media.get("date"));
        allMedia = allMedia.delete(pos);
        this.setState({
          media: allMedia,
        });
      } catch (e) {
        pos++;
      }
    }
  }

  onGlobalTagsChange(event) {
    this.setState({
      globalTags: event.target.value,
    });
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
        media.tags = metadata.hierarchicalTags.map(t => t.replace(/\|/g, "/")).join(", ");
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

  onChangeMediaTags(media, event) {
    let pos = this.state.media.indexOf(media);
    if (pos < 0) {
      return;
    }

    this.setState({
      media: this.state.media.setIn([pos, "tags"], event.target.value),
    });
  }

  render() {
    return (
      <div id="splitmain">
        <Sidebar/>
        <div id="content" className="vertical">
          <div className="horizontal" style={{ justifyContent: "space-between" }}>
            <label>Additional Tags for all Media: <input type="text" onChange={this.onGlobalTagsChange} value={this.state.globalTags}/></label>
            <button type="button" onClick={this.onUpload}>Upload</button>
          </div>
          <If condition={this.hasMedia}>
            <Then>
              <div className="medialist" onDragEnter={this.onDragEnter} onDragOver={this.onDragOver} onDrop={this.onDrop}>
                {this.state.media.toArray().map((media) => (
                  <Upload key={media.get("id")} name={media.get("file").name} bitmap={media.get("bitmap")} tags={media.get("tags")} onChangeTags={this.onChangeMediaTags.bind(this, media)}/>
                ))}
              </div>
            </Then>
            <Else>
              <div style={{ flex: 1, color: "gray" }} className="centerblock" onDragEnter={this.onDragEnter} onDragOver={this.onDragOver} onDrop={this.onDrop}>
                <p>Drag media here</p>
              </div>
            </Else>
          </If>
        </div>
      </div>
    );
  }
}

Upload.propTypes = {};
