import { RefCounted } from "./gc";
import { promiseEvent } from "./helpers";

type ImageSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
function sourceWidth(source: ImageSource): number {
  if (source instanceof HTMLImageElement) {
    return source.naturalWidth;
  }
  if (source instanceof HTMLVideoElement) {
    return source.videoWidth;
  }
  return source.width;
}

function sourceHeight(source: ImageSource): number {
  if (source instanceof HTMLImageElement) {
    return source.naturalHeight;
  }
  if (source instanceof HTMLVideoElement) {
    return source.videoHeight;
  }
  return source.height;
}

/**
 * Represents an image that can be drawn to a canvas or made available as a url.
 */
export abstract class Image {
  public abstract get width(): number;
  public abstract get height(): number;

  /**
   * Implements CanvasRenderingContext2D.drawImage with this image as the source.
   */
  public abstract drawImage(
    context: CanvasRenderingContext2D,
  ): Promise<void>;
  public abstract drawImage(
    context: CanvasRenderingContext2D,
    dx: number,
    dy: number,
  ): Promise<void>;
  public abstract drawImage(
    context: CanvasRenderingContext2D,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): Promise<void>;
  public abstract drawImage(
    context: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    sWidth: number,
    sHeight: number,
    dx: number,
    dy: number,
  ): Promise<void>;
  public abstract drawImage(
    context: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    sWidth: number,
    sHeight: number,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): Promise<void>;

  /**
   * Generates an object URL that can be used to display this image.
   */
  public abstract url(): RefCounted<string>;

  /**
   * Generates a data URL that can be used to display this image.
   */
  public abstract toDataUrl(): Promise<string>;

  public static from(source: ImageSource): Promise<Image>;
  public static from(source: ImageSource, x: number, y: number): Promise<Image>;
  public static from(
    source: ImageSource,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<Image>;
  public static from(
    source: ImageSource,
    x: number = 0,
    y: number = 0,
    width: number = sourceWidth(source),
    height: number = sourceHeight(source),
  ): Promise<Image> {
    return BlobImage.from(source, x, y, width, height);
  }

  /**
   * Decodes an image file data into an Image object.
   */
  public static decode(data: Blob): Promise<Image> {
    return BlobImage.decode(data);
  }
}

class BlobImage extends Image {
  private blobUrl: RefCounted<string> | undefined;

  private constructor(
    private readonly data: Blob,
    public readonly width: number,
    public readonly height: number,
  ) {
    super();
  }

  public async drawImage(
    context: CanvasRenderingContext2D,
    ...coords: number[]
  ): Promise<void> {
    let url = this.url();
    try {
      let image = document.createElement("img");
      image.src = url.get();
      await image.decode();

      if (coords.length == 0) {
        context.drawImage(image, 0, 0);
        return;
      }

      if (coords.length > 8 || coords.length % 2 != 0) {
        throw new Error(
          `Unexpected number of arguments (${coords.length}) passed to Image.drawImage`,
        );
      }

      /* @ts-ignore */
      context.drawImage(image, ...coords);
    } finally {
      url.release();
    }
  }

  public url(): RefCounted<string> {
    if (this.blobUrl) {
      return this.blobUrl.addRef();
    }

    let url = URL.createObjectURL(this.data);
    this.blobUrl = new RefCounted(url, (): void => {
      URL.revokeObjectURL(url);
      this.blobUrl = undefined;
    });

    return this.blobUrl;
  }

  public async toDataUrl(): Promise<string> {
    let reader = new FileReader();

    let promise = promiseEvent(reader, "loadend");
    reader.readAsDataURL(this.data);

    await promise;
    if (typeof reader.result == "string") {
      return reader.result;
    }

    throw reader.error;
  }

  public static async from(
    source: ImageSource,
    x: number = 0,
    y: number = 0,
    width: number = sourceWidth(source),
    height: number = sourceHeight(source),
  ): Promise<Image> {
    let sWidth = sourceWidth(source);
    let sHeight = sourceHeight(source);

    let sourceCanvas: HTMLCanvasElement;
    if (
      !(source instanceof HTMLCanvasElement) ||
      x != 0 || y != 0 ||
      width != sWidth || height != sHeight
    ) {
      sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = width;
      sourceCanvas.height = height;

      let ctxt = sourceCanvas.getContext("2d");
      if (!ctxt) {
        throw new Error("Canvas 2D context is not supported.");
      }
      ctxt.drawImage(source, x, y, width, height, 0, 0, width, height);
    } else {
      sourceCanvas = source;
    }

    let blob = await new Promise((resolve: BlobCallback, reject: (error: Error) => void): void => {
      try {
        sourceCanvas.toBlob(resolve, "image/png");
      } catch (e) {
        reject(e);
      }
    });

    if (!blob) {
      throw new Error("Failed to create blob from canvas.");
    }

    return new BlobImage(blob, width, height);
  }

  public static async decode(data: Blob): Promise<Image> {
    if (window.navigator.userAgent.includes("Firefox")) {
      console.log("Hey, this is Firefox!");
    } else {
      console.log("This is not Firefox.");
    }

    let url = URL.createObjectURL(data);
    try {
      let img = document.createElement("img");
      img.src = url;
      await img.decode();

      return Image.from(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
