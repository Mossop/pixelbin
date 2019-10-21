import React from "react";

import ImageCanvas from "../components/ImageCanvas";
import { Immutable } from "immer";
import { PendingUpload } from "../overlays/upload";

interface UploadProps {
  upload: Immutable<PendingUpload>;
}

export default class Upload extends React.Component<UploadProps> {
  public renderThumbnail(): React.ReactNode {
    if (this.props.upload.thumbnail) {
      return <ImageCanvas bitmap={this.props.upload.thumbnail} size={150} className="thumbnail"/>;
    } else {
      return <div className="processing thumbnail" style={{ width: "150px", height: "150px" }}/>;
    }
  }

  public render(): React.ReactNode {
    return <div className="media">
      {this.renderThumbnail()}
    </div>;
  }
}
