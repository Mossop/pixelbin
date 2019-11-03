import React from "react";
import MediaContainer, { MediaContainerProps } from "./MediaContainer";

type MediaProps = MediaContainerProps & {
  mimetype: string;
  src: string;
  autoplay?: boolean;
};

export default class Media extends React.Component<MediaProps> {
  public render(): React.ReactNode {
    if (this.props.mimetype.startsWith("video/")) {
      return <MediaContainer {...this.props}>
        <video src={this.props.src} controls={true} autoPlay={this.props.autoplay} style={{height: "100%", width: "100%" }}/>
      </MediaContainer>;
    } else {
      return <MediaContainer {...this.props}>
        <img src={this.props.src} style={{height: "100%", width: "100%" }}/>
      </MediaContainer>;
    }
  }
}
