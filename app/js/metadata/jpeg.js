import Uint8Reader from "./uint8reader";
import { ExifParser, EXIF_HEAD } from "./exif";
import { XMPParser, NS_XMP } from "./xmp";

export const JPEG_SOI = 0xFFD8;
const JPEG_SOS = 0xFFDA;
const JPEG_EOI = 0xFFD9;
const JPEG_APP1 = 0xFFE1;

export class JpegParser extends Uint8Reader {
  parse() {
    let metadata = {};

    // The header has already been checked.
    this.offset += 2;

    while (true) { // eslint-disable-line
      let id = this.read16();
      let length = this.read16() - 2;
      if ((this.offset + length) >= this.data.length) {
        console.error("Section ran over end of file.");
        return metadata;
      }

      switch (id) {
        case JPEG_SOS:
        case JPEG_EOI:
          return metadata;
        case JPEG_APP1: {
          let head6 = this.read(6, true);
          if (head6 == EXIF_HEAD) {
            let parser = new ExifParser(this.data.subarray(this.offset, this.offset + length), metadata);
            parser.parse();
          } else {
            let str = "";
            try {
              str = this.readStr(true);
            } catch (e) {
              // Ignore failures to read strings.
            }

            if (str == NS_XMP) {
              let parser = new XMPParser(this.data.subarray(this.offset, this.offset + length), metadata);
              parser.parse();
            }
          }
          break;
        }
      }

      this.offset += length;
    }
  }
}
