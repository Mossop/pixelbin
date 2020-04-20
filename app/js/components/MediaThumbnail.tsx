import React, { ReactNode, PureComponent } from "react";

import { isProcessed } from "../api/media";
import { getOrientation } from "../api/metadata";
import { MediaData } from "../api/types";
import { StoreState } from "../store/types";
import { connect, ComponentProps } from "../utils/component";
import ImageCanvas from "./ImageCanvas";
import MediaContainer from "./MediaContainer";

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

class MediaThumbnail extends PureComponent<ComponentProps<PassedProps, typeof mapStateToProps>> {
  public render(): ReactNode {
    let size = `${this.props.size}px`;
    if (isProcessed(this.props.media) && this.props.thumbnail) {
      let orientation = getOrientation(this.props.media);
      return <div
        className="media"
        draggable={this.props.draggable}
        onDragStart={this.props.onDragStart}
      >
        <MediaContainer
          width={this.props.thumbnail.width}
          height={this.props.thumbnail.height}
          orientation={orientation}
          style={{ width: size, height: size }}
        >
          <ImageCanvas bitmap={this.props.thumbnail} className="thumbnail"/>
        </MediaContainer>
      </div>;
    } else {
      return <div
        className="media"
        draggable={this.props.draggable}
        onDragStart={this.props.onDragStart}
      >
        <div className="processing thumbnail" style={{ width: size, height: size }}/>
      </div>;
    }
  }
}

export default connect<PassedProps>()(MediaThumbnail, mapStateToProps);
