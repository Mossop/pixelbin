import Uint8Reader from "./uint8reader";

export const EXIF_HEAD = 0x457869660000;

const ALIGN_INTEL = 0x4949;
const ALIGN_MOTO = 0x4D4D;
const ALIGN_CHECK = 0x002A;
const COMPONENT_SIZES = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

const ID_EXIF_IFD = 0x8769;
const ID_GPS_IFD = 0x8825;

const ID_KEYWORDS = 0x0019;
const ID_DATE = 0x003e;
const ID_TIME = 0x003f;

const DATE_RE = /^(\d{4}):(\d{2}):(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2}):(\d{2})$/;

export class ExifParser extends Uint8Reader {
  constructor(data, metadata){
    super(data);
    this.metadata = metadata;
    this.date = null;
    this.time = null;
  }

  readData(type, components) {
    let data = [];
    for (let i = 0; i < components; i++) {
      data.push(this.read(COMPONENT_SIZES[type]));
    }

    switch (type) {
      case 1: // uint8
      case 3: // uint16
      case 4: // uint32
        break;
      case 2: // string
        return String.fromCharCode(...data);
      default:
        throw new Error(`Unable to read tags of type ${type}`);
    }

    if (components == 1) {
      return data[0];
    }
    return data;
  }

  parseIFD() {
    let count = this.read16();
    for (let i = 0; i < count; i++) {
      let tag = this.read16();
      let type = this.read16();
      let components = this.read32();

      // Record where the next entry starts
      let offset = this.offset + 4;

      if ((COMPONENT_SIZES[type] * components) > 4) {
        this.offset = this.tiffOffset + this.read32();
      }

      // Now positioned to read the data if we want it.
      switch (tag) {
        case ID_GPS_IFD:
        case ID_EXIF_IFD: {
          let ifdOffset = this.readData(type, components);
          this.offset = this.tiffOffset + ifdOffset;
          this.parseIFD();
          break;
        }
        case ID_KEYWORDS:
          this.metadata.keywords = this.readData(type, components);
          break;
        case ID_DATE:
          this.date = this.readData(type, components);
          break;
        case ID_TIME:
          this.time = this.readData(type, components);
          break;
      }

      this.offset = offset;
    }
  }

  parse() {
    this.offset += 6;

    // Where the TIFF header starts is the relative position for all offsets.
    this.tiffOffset = this.offset;

    let align = this.read16();
    if (align == ALIGN_INTEL) {
      this.alignment = false;
    } else if (align != ALIGN_MOTO) {
      console.error("Unexpected alignment data", align.toString(16));
      return;
    }

    let check = this.read16();
    if (check != ALIGN_CHECK) {
      console.error("Alignment check failed", check.toString(16));
      return;
    }

    this.offset = this.tiffOffset + this.read32();

    let nextIfd;
    do {
      this.parseIFD();
      nextIfd = this.read32();
      this.offset = this.tiffOffset + nextIfd;
    } while (nextIfd != 0);

    if (this.date) {
      let matches = DATE_RE.match(this.date);
      if (!matches) {
        return;
      }

      let [, year, month, day] = matches;

      if (this.time) {
        matches = TIME_RE.match(this.date);
        if (!matches) {
          return;
        }
        let [, hour, minute, second] = matches;

        this.metadata.date = new Date(year, month, day, hour, minute, second, 0);
      } else {
        this.metadata.date = new Date(year, month, day, 0, 0, 0, 0);
      }
    }

    return;
  }
}
