import { JpegParser } from "./jpeg";
import fileType from "file-type";

function loadBlob(blob) {
  return new Promise((resolve) => {
    let reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.readAsArrayBuffer(blob);
  });
}

export async function detectMimeType(blobOrBuffer) {
  let buffer = (blobOrBuffer instanceof Blob) ? await loadBlob(blobOrBuffer) : blobOrBuffer;
  let type = fileType(buffer);
  if (!type) {
    return null;
  }

  return type.mime;
}

export async function parseMetadata(blob) {
  try {
    let buffer = await loadBlob(blob);

    let type = await detectMimeType(buffer);
    switch (type) {
      case "image/jpeg": {
        let parser = new JpegParser(new DataView(buffer));
        return parser.parse();
      }
      case "video/mp4": {
        return {
          mimetype: "video/mp4",
        };
      }
      default:
        throw new Error("Unknown file type");
    }
  } catch (e) {
    console.error("Failed to parse metadata", e);
    return {
      mimetype: null,
    };
  }
}

function loadVideo(video, url) {
  return new Promise((resolve, reject) => {
    video.addEventListener("canplay", resolve, { once: true });
    video.addEventListener("error", reject, { once: true });
    video.src = url;
  });
}

export async function createThumbnail(blob) {
  let type = await detectMimeType(blob);
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
