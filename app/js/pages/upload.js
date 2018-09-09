import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import moment from "moment";

import Sidebar from "../content/Sidebar";
import Upload from "../content/Upload";
import { bindAll, uuid } from "../utils/helpers";
import { If, Then, Else } from "../utils/if";
import { upload } from "../api/media";
import { setTags } from "../utils/actions";

const REGEX_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const REGEX_TIME = /^(\d{2}):(\d{2})$/;

const MEDIA_TYPES = [
  "image/jpeg",
  "video/mp4",
];

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
      media: [],
      globalTags: "",
    };

    bindAll(this, [
      "onDragEnter",
      "onDragOver",
      "onDrop",
      "onGlobalTagsChange",
      "onUpload",
      "hasMedia",
      "onChangeMediaTags",
      "onChangeMediaDate",
      "onChangeMediaTime",
    ]);
  }

  hasMedia() {
    return this.state.media.length > 0;
  }

  async uploadMedia(media, additionalTags) {
    let newTags = await upload(media.file, media.metadata, additionalTags);
    this.props.onNewTags(newTags);

    let newMedia = this.state.media.filter(m => m != media);
    this.setState({
      media: newMedia,
    });
  }

  onUpload() {
    for (let media of this.state.media) {
      this.uploadMedia(media, this.state.globalTags);
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

  async addFile(file) {
    let { parseMetadata, createThumbnail } = await import(/* webpackChunkName: "metadata" */ "../metadata/parser");

    let media = {
      id: uuid(),
      file,
      bitmap: null,
      metadata: {
        tags: "",
        date: moment(file.lastModified),
        longitude: null,
        latitude: null,
      },
    };

    let metadata = await parseMetadata(file);
    if ("hierarchicalTags" in metadata) {
      media.metadata.tags = metadata.hierarchicalTags.map(t => t.replace(/\|/g, "/")).join(", ");
    } else if ("tags" in metadata) {
      media.metadata.tags = metadata.tags.join(", ");
    }
    if ("date" in metadata) {
      media.metadata.date = metadata.date;
    }
    if (("longitude" in metadata) && ("latitude" in metadata)) {
      media.metadata.latitude = metadata.latitude;
      media.metadata.longitude = metadata.longitude;
    }

    let newMedia = this.state.media.slice(0);
    newMedia.push(media);
    this.setState({
      media: newMedia,
    });

    createThumbnail(file).then((bitmap) => {
      media.bitmap = bitmap;
      media.metadata.width = bitmap.width;
      media.metadata.height = bitmap.height;
      this.setState({
        media: this.state.media,
      });
    });
  }

  async addFiles(files) {
    for (let file of files) {
      this.addFile(file);
    }
  }

  onChangeMediaTags(media, event) {
    media.metadata.tags = event.target.value;

    this.setState({
      media: this.state.media,
    });
  }

  onChangeMediaDate(media, event) {
    let matches = REGEX_DATE.exec(event.target.value);
    if (matches) {
      media.metadata.date.year(parseInt(matches[1]));
      media.metadata.date.month(parseInt(matches[2]) - 1);
      media.metadata.date.date(parseInt(matches[3]));

      this.setState({
        media: this.state.media,
      });
    }
  }

  onChangeMediaTime(media, event) {
    let matches = REGEX_TIME.exec(event.target.value);
    if (matches) {
      media.metadata.date.hour(parseInt(matches[1]));
      media.metadata.date.minute(parseInt(matches[2]));

      this.setState({
        media: this.state.media,
      });
    }
  }

  render() {
    return (
      <div id="splitmain">
        <Sidebar selectedTags={[]}/>
        <div id="content" className="vertical">
          <div className="horizontal" style={{ justifyContent: "space-between" }}>
            <label>Additional Tags for all Media: <input type="text" onChange={this.onGlobalTagsChange} value={this.state.globalTags}/></label>
            <button type="button" onClick={this.onUpload}>Upload</button>
          </div>
          <If condition={this.hasMedia}>
            <Then>
              <div className="medialist" onDragEnter={this.onDragEnter} onDragOver={this.onDragOver} onDrop={this.onDrop}>
                {this.state.media.map((media) => (
                  <Upload key={media.id} name={media.file.name} bitmap={media.bitmap} metadata={media.metadata}
                    onChangeTags={this.onChangeMediaTags.bind(this, media)}
                    onChangeDate={this.onChangeMediaDate.bind(this, media)}
                    onChangeTime={this.onChangeMediaTime.bind(this, media)}/>
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
