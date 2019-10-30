import React from "react";

import ImageCanvas from "../components/ImageCanvas";
import { PendingUpload } from "../overlays/upload";
import MediaContainer from "./MediaContainer";

interface UploadProps {
  upload: PendingUpload;
  onClick: () => void;
}

export default class Upload extends React.Component<UploadProps> {
  public renderThumbnail(): React.ReactNode {
    let thumb = this.props.upload.thumbnail;
    if (thumb) {
      return <MediaContainer width={thumb.width} height={thumb.height} orientation={this.props.upload.orientation} style={{ width: "150px", height: "150px" }}>
        <ImageCanvas bitmap={this.props.upload.thumbnail} className="thumbnail"/>
      </MediaContainer>;
    } else {
      return <div className="processing thumbnail" style={{ width: "150px", height: "150px" }}/>;
    }
  }

  public render(): React.ReactNode {
    return <div className="media" onClick={this.props.onClick}>
      {this.renderThumbnail()}
    </div>;
  }
}
