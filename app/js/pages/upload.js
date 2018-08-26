import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { List, Map } from "immutable";
import moment from "moment";

import Sidebar from "../content/sidebar";
import Upload from "../content/upload";
import { bindAll } from "../utils/helpers";
import { If, Then, Else } from "../utils/if";
import { upload } from "../api/media";
import { setTags } from "../utils/actions";

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

const mapDispatchToProps = (dispatch) => ({
  onNewTags: (tags) => dispatch(setTags(tags)),
});

class UploadPage extends React.Component {
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
        let gps = null;
        if (media.has("latitude") && media.has("longitude")) {
          gps = {
            latitude: media.get("latitude"),
            longitude: media.get("longitude"),
          };
        }

        let newTags = await upload(media.get("file"), tags, media.get("date"), gps);
        allMedia = allMedia.delete(pos);
        this.setState({
          media: allMedia,
        });

        this.props.onNewTags(newTags);
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
    let { parseMetadata, createThumbnail } = await import(/* webpackChunkName: "metadata" */ "../metadata/parser");

    for (let file of files) {
      let media = {
        id: uuid(),
        file: file,
        bitmap: await createThumbnail(file),
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
      if (("longitude" in metadata) && ("latitude" in metadata)) {
        media.latitude = metadata.latitude;
        media.longitude = metadata.longitude;
      }

      this.setState({
        media: this.state.media.push(Map(media)),
      });
    }
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

UploadPage.propTypes = {
  onNewTags: PropTypes.func.isRequired,
};

export default connect(null, mapDispatchToProps)(UploadPage);
