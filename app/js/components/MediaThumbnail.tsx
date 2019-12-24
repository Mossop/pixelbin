import React from "react";
import { Media, isProcessed } from "../api/types";
import { StoreState } from "../store/types";
import { connect } from "react-redux";
import ImageCanvas from "./ImageCanvas";
import MediaContainer from "./MediaContainer";
import { getOrientation } from "../api/metadata";

interface MediaProps {
  media: Media;
  thumbnail?: ImageBitmap;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent) => void;
}

interface StateProps {
  size: number;
}

function mapStateToProps(state: StoreState): StateProps {
  return {
    size: state.settings.thumbnailSize,
  };
}

type AllProps = StateProps & MediaProps;

class MediaThumbnail extends React.Component<AllProps> {
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
