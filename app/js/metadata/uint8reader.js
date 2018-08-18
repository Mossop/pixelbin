export default class Uint8Reader {
  constructor(data, alignment = true) {
    this.data = data;
    this.offset = 0;
    this.alignment = alignment;
  }

  read(length, peek = false) {
    let result = 0;
    let direction = this.alignment ? +1 : -1;
    let offset = this.alignment ? this.offset : this.offset + length - 1;

    for (let i = 0; i < length; i++) {
      result *= 0x100;
      result += this.data[offset];
      offset += direction;
    }

    if (!peek) {
      this.offset += length;
    }

    return result;
  }

  readStr(peek = false) {
    let offset = this.offset;
    let bytes = [];
    let byte = this.read8();
    while (byte != 0 && this.offset < this.data.length) {
      bytes.push(byte);
      byte = this.read8();
    }

    if (byte != 0) {
      throw new Error("String never terminated.");
    }

    if (peek) {
      this.offset = offset;
    }

    return String.fromCharCode(...bytes);
  }

  read8(peek = false) {
    let value = this.data[this.offset];

    if (!peek) {
      this.offset += 1;
    }

    return value;
  }

  read16(peek = false) {
    return this.read(2, peek);
  }

  read32(peek = false) {
    return this.read(4, peek);
  }
}
