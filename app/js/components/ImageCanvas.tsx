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

    let size = canvas.height;
    let width = bitmap.width;
    let height = bitmap.height;
    if (width > height) {
      width = size;
      height = bitmap.height / (bitmap.width / width);
    } else {
      height = size;
      width = bitmap.width / (bitmap.height / height);
    }

    let context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
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
      }
    });

    return (
      <canvas ref={this.canvasRef} height={size} width={size} {...props}/>
    );
  }
}

export default ImageCanvas;
