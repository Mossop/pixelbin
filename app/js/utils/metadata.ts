import { parseBuffer } from "media-metadata";
import { Metadata } from "media-metadata/lib/metadata";
import { uuid } from "./helpers";

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

export async function parseMedia(file: File): Promise<MediaForUpload | null> {
  try {
    let buffer = await loadBlob(file);
    return {
      id: uuid(),
      file,
      metadata: await parseBuffer(buffer),
    };
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

export async function createThumbnail(blob: Blob, type: string): Promise<ImageBitmap | null> {
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
