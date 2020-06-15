import React, { ReactNode, PureComponent } from "react";

import { PendingUpload } from "../overlays/upload";
import ImageCanvas from "./ImageCanvas";
import MediaContainer from "./MediaContainer";

interface UploadProps {
  upload: PendingUpload;
  onClick: (upload: PendingUpload) => void;
}

export default class Upload extends PureComponent<UploadProps> {
  private onClick = (): void => {
    this.props.onClick(this.props.upload);
  };

  public renderThumbnail(): ReactNode {
    let thumb = this.props.upload.thumbnail;
    if (thumb) {
      return <MediaContainer
        width={thumb.width}
        height={thumb.height}
        orientation={this.props.upload.thumbnailOrientation}
        style={{ width: "150px", height: "150px" }}
      >
        <ImageCanvas bitmap={this.props.upload.thumbnail} className="thumbnail"/>
      </MediaContainer>;
    } else {
      return <div className="processing thumbnail" style={{ width: "150px", height: "150px" }}/>;
    }
  }

  public render(): ReactNode {
    return <div className="media" onClick={this.onClick}>
      {this.renderThumbnail()}
    </div>;
  }
}
