import { inflateSync } from "node:zlib";

const pngSignature = Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let i = 0; i < 8; i++) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : value >>> 1;
  }
  return value >>> 0;
});
function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(kind: string, data: Buffer): Buffer {
  const type = Buffer.from(kind, "ascii");
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  type.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, 8 + data.length)), 8 + data.length);
  return result;
}

export interface SanitizedAvatar {
  readonly png: Buffer;
  readonly width: number;
  readonly height: number;
}

/**
 * Accept Flutter's decoded/cropped PNG output only. Strip every ancillary
 * chunk, including EXIF/text/color profile metadata; validate image data,
 * checksums, scanline filters and decompressed size before storing anything.
 */
export function sanitizeAvatarPng(input: Buffer): SanitizedAvatar {
  const invalid = () => new TypeError("profiles.avatar.invalid_png");
  if (input.byteLength > 2 * 1024 * 1024 || input.byteLength < 60 ||
      !input.subarray(0, 8).equals(pngSignature)) throw invalid();
  let offset = 8;
  let chunks = 0;
  let width = 0;
  let height = 0;
  let channels = 0;
  let seenIHDR = false;
  let seenIEND = false;
  let seenIDAT = false;
  let idatEnded = false;
  const idat: Buffer[] = [];
  while (offset < input.length) {
    if (++chunks > 256) throw invalid();
    if (offset + 12 > input.length) throw invalid();
    const length = input.readUInt32BE(offset);
    if (length > input.length - offset - 12) throw invalid();
    const kind = input.toString("ascii", offset + 4, offset + 8);
    const payload = input.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = input.readUInt32BE(offset + 8 + length);
    if (crc32(input.subarray(offset + 4, offset + 8 + length)) !== expectedCrc) {
      throw invalid();
    }
    if (!seenIHDR && kind !== "IHDR") throw invalid();
    if (kind === "IHDR") {
      if (seenIHDR || length !== 13) throw invalid();
      seenIHDR = true;
      width = payload.readUInt32BE(0);
      height = payload.readUInt32BE(4);
      const bitDepth = payload[8];
      const colorType = payload[9];
      channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
      if (width < 64 || width > 1024 || height < 64 || height > 1024 ||
          width * height > 1024 * 1024 || bitDepth !== 8 || !channels ||
          payload[10] !== 0 || payload[11] !== 0 || payload[12] !== 0) {
        throw invalid();
      }
    } else if (kind === "IDAT") {
      if (idatEnded || seenIEND || idat.length >= 128 || length === 0) throw invalid();
      idat.push(payload);
      seenIDAT = true;
    } else if (kind === "IEND") {
      if (!seenIDAT || length !== 0 || seenIEND) throw invalid();
      seenIEND = true;
      if (offset + 12 !== input.length) throw invalid();
    } else {
      // Unknown critical PNG chunks could affect actual pixels; fail closed.
      if (kind[0] !== kind[0]?.toLowerCase()) throw invalid();
      if (seenIDAT) idatEnded = true;
    }
    offset += length + 12;
    if (seenIEND) break;
  }
  if (!seenIHDR || !seenIDAT || !seenIEND || offset !== input.length) throw invalid();
  const expectedBytes = height * (width * channels + 1);
  let pixels: Buffer;
  try {
    pixels = inflateSync(Buffer.concat(idat), {
      maxOutputLength: expectedBytes + 1,
    });
  } catch {
    throw invalid();
  }
  if (pixels.length !== expectedBytes) throw invalid();
  for (let row = 0; row < height; row++) {
    if (pixels[row * (width * channels + 1)]! > 4) throw invalid();
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  // Compression, filter and interlace are zero.
  return Object.freeze({
    width,
    height,
    png: Buffer.concat([
      pngSignature,
      chunk("IHDR", ihdr),
      chunk("IDAT", Buffer.concat(idat)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  });
}
