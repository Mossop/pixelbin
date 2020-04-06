import { Orientation } from "media-metadata/lib/metadata";
import React, { ReactNode, SVGProps, PureComponent } from "react";

import { getTransformForOrientation, areDimensionsFlipped } from "../utils/metadata";
import { StyleProps, styleProps } from "./shared";

export type MediaContainerProps = {
  orientation?: Orientation;
  width: number;
  height: number;
} & StyleProps;

export default class MediaContainer extends PureComponent<MediaContainerProps> {
  public get orientation(): Orientation {
    return this.props.orientation ?? Orientation.TopLeft;
  }

  public render(): ReactNode {
    let props: SVGProps<SVGSVGElement> = {
      ...styleProps(this.props),
    };

    let [width, height] = [this.props.width, this.props.height];

    let [viewWidth, viewHeight] = [width, height];
    if (areDimensionsFlipped(this.orientation)) {
      [viewWidth, viewHeight] = [viewHeight, viewWidth];
    }

    props.viewBox = `${-viewWidth / 2} ${-viewHeight / 2} ${viewWidth} ${viewHeight}`;

    return <svg {...props}>
      <foreignObject
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        transform={getTransformForOrientation(this.orientation)}
      >
        {this.props.children}
      </foreignObject>
    </svg>;
  }
}
