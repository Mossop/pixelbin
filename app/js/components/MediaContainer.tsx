import React from "react";

import { Orientation } from "media-metadata/lib/metadata";
import { getTransformForOrientation, areDimensionsFlipped } from "../utils/metadata";
import { StyleProps, styleProps } from "./shared";

export type MediaContainerProps = {
  orientation: Orientation;
  width: number;
  height: number;
} & StyleProps;

export default class MediaContainer extends React.Component<MediaContainerProps> {
  public render(): React.ReactNode {
    let props: React.SVGProps<SVGSVGElement> = {
      ...styleProps(this.props),
    };

    let [width, height] = [this.props.width, this.props.height];

    let [viewWidth, viewHeight] = [width, height];
    if (areDimensionsFlipped(this.props.orientation)) {
      [viewWidth, viewHeight] = [viewHeight, viewWidth];
    }

    props.viewBox = `${-viewWidth/2} ${-viewHeight/2} ${viewWidth} ${viewHeight}`;

    return <svg {...props}>
      <foreignObject x={-width/2} y={-height/2} width={width} height={height} transform={getTransformForOrientation(this.props.orientation)}>
        {this.props.children}
      </foreignObject>
    </svg>;
  }
}
