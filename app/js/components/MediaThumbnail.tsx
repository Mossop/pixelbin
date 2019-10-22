import React from "react";
import { Media } from "../api/types";
import { StoreState } from "../store/types";
import { connect } from "react-redux";
import ImageCanvas from "./ImageCanvas";

interface MediaProps {
  media: Media;
  thumbnail?: ImageBitmap;
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
  private onDragStart: (event: React.DragEvent) => void = (event: React.DragEvent): void => {
    event.dataTransfer.setData("pixelbin/media", this.props.media.id);
    event.dataTransfer.effectAllowed = "copyMove";
  };

  public render(): React.ReactNode {
    if (this.props.thumbnail) {
      return <div className="media" draggable={true} onDragStart={this.onDragStart}>
        <ImageCanvas bitmap={this.props.thumbnail} size={this.props.size} className="thumbnail"/>
      </div>;
    } else {
      return <div className="media" draggable={true} onDragStart={this.onDragStart}>
        <div className="processing thumbnail" style={{ width: `${this.props.size}px`, height: `${this.props.size}px` }}/>
      </div>;
    }
  }
}

export default connect(mapStateToProps)(MediaThumbnail);
