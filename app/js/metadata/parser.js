import DataReader from "./datareader";
import { JpegParser, JPEG_SOI } from "./jpeg";

class FileParser extends DataReader {
  parse() {
    let header = this.read16(true);
    if (header == JPEG_SOI) {
      let parser = new JpegParser(this.data);
      return parser.parse();
    }

    throw new Error("Unknown file format.");
  }
}

function loadBlob(blob) {
  return new Promise((resolve) => {
    let reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.readAsArrayBuffer(blob);
  });
}

export async function parseMetadata(blob) {
  try {
    let buffer = await loadBlob(blob);
    let data = new DataView(buffer);
    let parser = new FileParser(data);
    return parser.parse();
  } catch (e) {
    console.error("Failed to parse metadata", e);
    return {};
  }
}
