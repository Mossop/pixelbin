import { JpegParser, JPEG_SOI, JPEG_EOI } from "./jpeg";

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
  let header = data.getUint16(0, false);
  if (header == JPEG_SOI) {
    let footer = data.getUint16(data.byteLength - 2, false);
    if (footer == JPEG_EOI) {
      return "image/jpeg";
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

export async function createThumbnail(blob) {
  let type = await detectMimeType(blob);
  switch (type) {
    case "image/jpeg":
      return createImageBitmap(blob);
    default:
      console.error(new Error("Unknown file type"));
  }
  return null;
}
