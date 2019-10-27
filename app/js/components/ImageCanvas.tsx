import React from "react";

import { styleProps, StyleProps } from "../components/shared";

type ImageCanvasProps = {
  bitmap?: ImageBitmap;
  size: number;
} & StyleProps;

class ImageCanvas extends React.Component<ImageCanvasProps> {
  private canvasRef: React.RefObject<HTMLCanvasElement>;

  public constructor(props: ImageCanvasProps) {
    super(props);
    this.canvasRef = React.createRef();
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
    if (this.props.bitmap === prevProps.bitmap && this.props.size === prevProps.size) {
      return;
    }

    this.drawBitmap(this.props.bitmap);
  }

  public render(): React.ReactNode {
    let { size } = this.props;
    let props = styleProps(this.props, {
      className: "image-canvas",
      style: {
        height: size,
        width: size,
        objectFit: "contain",
      }
    });

    return (
      <canvas ref={this.canvasRef} {...props}/>
    );
  }
}

export default ImageCanvas;
