import { parseBuffer } from "media-metadata";
import { Metadata, Orientation } from "media-metadata/lib/metadata";

export interface MediaForUpload {
  id: string;
  file: File;
  bitmap?: ImageBitmap;
  metadata: Metadata;
}

function loadBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve: (b: ArrayBuffer) => void, reject: () => void): void => {
    let reader = new FileReader();
    reader.onload = (): void => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject();
      }
    };
    reader.readAsArrayBuffer(blob);
  });
}

export async function parseMetadata(file: File): Promise<Metadata | null> {
  try {
    let buffer = await loadBlob(file);
    return await parseBuffer(buffer);
  } catch (e) {
    console.error("Failed to parse metadata", e);
    return null;
  }
}

function loadVideo(video: HTMLVideoElement, url: string): Promise<void> {
  return new Promise((resolve: () => void, reject: () => void): void => {
    video.addEventListener("canplay", resolve, { once: true });
    video.addEventListener("error", reject, { once: true });
    video.src = url;
  });
}

export async function loadPreview(blob: Blob, type: string): Promise<ImageBitmap | null> {
  switch (type) {
    case "image/jpeg":
      return createImageBitmap(blob);
    case "video/mp4": {
      let video = document.createElement("video");
      let url = URL.createObjectURL(blob);
      await loadVideo(video, url);
      let bitmap = await createImageBitmap(video);
      URL.revokeObjectURL(url);
      return bitmap;
    }
    default:
      console.error(new Error("Unknown file type"));
  }
  return null;
}

export function tagsToString(tags: string[][]): string {
  return tags.filter((t: string[]) => t.length)
    .map((t: string[]) => t.join("/"))
    .join(", ");
}

export function tagsFromString(tags: string): string[][] {
  return tags.split(/[,\n]/)
    .map((t: string) => t.trim())
    .filter((t: string) => t.length)
    .map((t: string) => t.split("/"));
}

export function peopleToString(people: string[]): string {
  return people.filter((p: string) => p.length).join("\n");
}

export function peopleFromString(people: string): string[] {
  return people.split(/[,\n]/)
    .map((p: string) => p.trim())
    .filter((p: string) => p.length);
}

export function areDimensionsFlipped(orientation: Orientation): boolean {
  switch (orientation) {
    case Orientation.RightTop:
    case Orientation.RightBottom:
    case Orientation.LeftBottom:
    case Orientation.LeftTop:
      return true;
    default:
      return false;
  }
}

export function getTransformForOrientation(orientation: Orientation = Orientation.TopLeft): string | undefined {
  switch (orientation) {
    case Orientation.TopLeft:
      return undefined;
    case Orientation.RightTop:
      return "rotate(90)";
    case Orientation.BottomRight:
      return "rotate(180)";
    case Orientation.LeftBottom:
      return "rotate(-90)";
    case Orientation.TopRight:
      return "scale(-1, 1)";
    case Orientation.BottomLeft:
      return "scale(1, -1)";
    case Orientation.LeftTop:
      return "scale(1, -1) rotate(-90)";
    case Orientation.RightBottom:
      return "scale(1, -1) rotate(90)";
  }
}
