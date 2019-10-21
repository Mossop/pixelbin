import React from "react";
import { Media } from "../api/types";
import { StoreState } from "../store/types";
import { connect } from "react-redux";

interface MediaProps {
  media: Media;
}

interface StateProps {
  size: number;
}

function mapStateToProps(state: StoreState): StateProps {
  return {
    size: state.settings.thumbnailSize,
  };
}

class MediaThumb extends React.Component<StateProps & MediaProps> {
  public render(): React.ReactNode {
    return <div className="media">
      <div className="processing thumbnail" style={{ width: `${this.props.size}px`, height: `${this.props.size}px` }}/>
    </div>;
  }
}

export const MediaThumbnail = connect(mapStateToProps)(MediaThumb);
