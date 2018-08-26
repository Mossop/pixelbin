import { JpegParser, JPEG_SOI, JPEG_EOI } from "./jpeg";

const MP4_FTYP = 0x66747970;

function loadBlob(blob) {
  return new Promise((resolve) => {
    let reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.readAsArrayBuffer(blob);
  });
}

export async function detectMimeType(blobOrBuffer) {
  let buffer = (blobOrBuffer instanceof Blob) ? await loadBlob(blobOrBuffer) : blobOrBuffer;
  let data = new DataView(buffer);

  let header16 = data.getUint16(0);
  if (header16 == JPEG_SOI) {
    let footer = data.getUint16(data.byteLength - 2);
    if (footer == JPEG_EOI) {
      return "image/jpeg";
    }
  }

  let header32 = data.getUint32(0);
  if (header32 < data.byteLength) {
    header32 = data.getUint32(4);
    if (header32 == MP4_FTYP) {
      return "video/mp4";
    }
  }

  return null;
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
      default:
        throw new Error("Unknown file type");
    }
  } catch (e) {
    console.error("Failed to parse metadata", e);
    return {};
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
