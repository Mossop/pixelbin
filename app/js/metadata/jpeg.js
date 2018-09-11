import DataReader from "./datareader";
import { ExifParser, EXIF_HEAD } from "./exif";
import { XMPParser, NS_XMP } from "./xmp";

const JPEG_EOI = 0xFFD9;
const JPEG_SOS = 0xFFDA;
const JPEG_APP1 = 0xFFE1;

export class JpegParser extends DataReader {
  parse() {
    let metadata = {
      mimetype: "image/jpeg",
    };

    // The header has already been checked.
    this.offset += 2;

    while (true) { // eslint-disable-line
      let id = this.read16();
      let length = this.read16() - 2;
      if ((this.offset + length) >= this.data.byteLength) {
        console.error("Section ran over end of file.");
        return metadata;
      }

      switch (id) {
        case JPEG_SOS:
        case JPEG_EOI:
          return metadata;
        case JPEG_APP1: {
          let str = "";
          try {
            str = this.readStr(true);
          } catch (e) {
            // Ignore failures to read strings.
          }

          if (str == EXIF_HEAD) {
            let parser = new ExifParser(this.data, this.offset, metadata);
            parser.parse();
          }
          else if (str == NS_XMP) {
            let parser = new XMPParser(this.data, this.offset, metadata);
            parser.parse(length);
          }
          break;
        }
      }

      this.offset += length;
    }
  }
}
