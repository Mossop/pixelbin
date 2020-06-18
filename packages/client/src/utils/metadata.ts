import { Metadata, Orientation, parseBuffer } from "media-metadata";

import { document } from "../environment";

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

export async function loadFrame(
  blob: Blob,
  type: string,
  width?: number,
  height?: number,
): Promise<ImageBitmap | null> {
  if (type.startsWith("image/")) {
    return createImageBitmap(blob);
  }

  if (type.startsWith("video/")) {
    let video = document.createElement("video");
    if (width) {
      video.width = width;
    }
    if (height) {
      video.height = height;
    }
    let url = URL.createObjectURL(blob);
    await loadVideo(video, url);
    let bitmap = await createImageBitmap(video);
    URL.revokeObjectURL(url);
    return bitmap;
  }

  return null;
}

export function tagsToString(tags: string[][]): string {
  return tags.filter((t: string[]): number => t.length)
    .map((t: string[]): string => t.join("/"))
    .join(", ");
}

export function tagsFromString(tags: string): string[][] {
  return tags.split(/[,\n]/)
    .map((t: string): string => t.trim())
    .filter((t: string): number => t.length)
    .map((t: string): string[] => {
      return t.split("/")
        .map((i: string): string => i.trim())
        .filter((i: string): number => i.length);
    });
}

export function peopleToString(people: string[]): string {
  return people.filter((p: string): number => p.length).join("\n");
}

export function peopleFromString(people: string): string[] {
  return people.split(/[,\n]/)
    .map((p: string): string => p.trim())
    .filter((p: string): number => p.length);
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

export function getTransformForOrientation(
  orientation: Orientation = Orientation.TopLeft,
): string | undefined {
  switch (orientation) {
    case Orientation.TopLeft:
      return undefined;
    case Orientation.RightTop:
      return "rotate(90)";
    case Orientation.BottomRight:
      return "scale(-1, -1)";
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