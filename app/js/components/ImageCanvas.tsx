import React, { CSSProperties, ReactNode, PureComponent, createRef, RefObject } from "react";

import { styleProps, StyleProps } from "../utils/props";

type ImageCanvasProps = {
  bitmap?: ImageBitmap;
} & StyleProps;

export default class ImageCanvas extends PureComponent<ImageCanvasProps> {
  private canvasRef: RefObject<HTMLCanvasElement>;

  public constructor(props: ImageCanvasProps) {
    super(props);
    this.canvasRef = createRef();
  }

  private drawBitmap(bitmap: ImageBitmap | undefined): void {
    if (!bitmap) {
      return;
    }

    let canvas = this.canvasRef.current;
    if (!canvas) {
      return;
    }

    let context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    context.drawImage(bitmap, 0, 0);
  }

  public componentDidMount(): void {
    this.drawBitmap(this.props.bitmap);
  }

  public componentDidUpdate(prevProps: ImageCanvasProps): void {
    if (this.props.bitmap === prevProps.bitmap) {
      return;
    }

    this.drawBitmap(this.props.bitmap);
  }

  public render(): ReactNode {
    let props = styleProps(this.props, {
      className: "image-canvas",
    });

    let innerStyle: CSSProperties = {
      objectFit: "contain",
      width: "100%",
      height: "100%",
    };

    return <div {...props}>
      <canvas ref={this.canvasRef} style={innerStyle}/>
    </div>;
  }
}
