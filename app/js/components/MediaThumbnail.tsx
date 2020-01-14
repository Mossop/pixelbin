import React from "react";
import { connect } from "react-redux";

import { MediaData, isProcessed } from "../api/media";
import { StoreState } from "../store/types";
import { getOrientation } from "../api/metadata";
import ImageCanvas from "./ImageCanvas";
import MediaContainer from "./MediaContainer";
import { ComponentProps } from "./shared";

interface PassedProps {
  media: MediaData;
  thumbnail?: ImageBitmap;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent) => void;
}

interface FromStateProps {
  size: number;
}

function mapStateToProps(state: StoreState): FromStateProps {
  return {
    size: state.settings.thumbnailSize,
  };
}

type MediaThumbnailProps = ComponentProps<PassedProps, typeof mapStateToProps>;
class MediaThumbnail extends React.Component<MediaThumbnailProps> {
  public render(): React.ReactNode {
    let size = `${this.props.size}px`;
    if (isProcessed(this.props.media) && this.props.thumbnail) {
      let orientation = getOrientation(this.props.media);
      return <div className="media" draggable={this.props.draggable} onDragStart={this.props.onDragStart}>
        <MediaContainer width={this.props.thumbnail.width} height={this.props.thumbnail.height} orientation={orientation} style={{ width: size, height: size }}>
          <ImageCanvas bitmap={this.props.thumbnail} className="thumbnail"/>
        </MediaContainer>
      </div>;
    } else {
      return <div className="media" draggable={this.props.draggable} onDragStart={this.props.onDragStart}>
        <div className="processing thumbnail" style={{ width: size, height: size }}/>
      </div>;
    }
  }
}

export default connect(mapStateToProps)(MediaThumbnail);
