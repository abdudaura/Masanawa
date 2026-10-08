import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { sanitizeAvatarPng } from "./png.js";

const signature = Buffer.from([137,80,78,71,13,10,26,10]);
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name: string, data: Buffer) {
  const payload = Buffer.concat([Buffer.from(name), data]);
  const result = Buffer.alloc(payload.length + 8);
  result.writeUInt32BE(data.length, 0);
  payload.copy(result, 4);
  result.writeUInt32BE(crc32(payload), result.length - 4);
  return result;
}
function fixture(input?: Readonly<{
  width?: number; height?: number; filter?: number;
  metadata?: boolean;
}>) {
  const width = input?.width ?? 64;
  const height = input?.height ?? 64;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(height * (width * 4 + 1), 0);
  for (let y = 0; y < height; y++) {
    rows[y * (width * 4 + 1)] = input?.filter ?? 0;
  }
  return Buffer.concat([
    signature, chunk("IHDR", header),
    ...(input?.metadata ? [chunk("tEXt", Buffer.from("GPS=private-location"))] : []),
    chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("Avatar PNG image safety and metadata removal", () => {
  it("validates and strips every metadata chunk before S3 upload", () => {
    const original = fixture({ metadata: true });
    const sanitized = sanitizeAvatarPng(original);
    expect(sanitized.width).toBe(64);
    expect(sanitized.height).toBe(64);
    expect(sanitized.png.includes(Buffer.from("GPS"))).toBe(false);
    expect(sanitized.png.includes(Buffer.from("tEXt"))).toBe(false);
    expect(sanitizeAvatarPng(sanitized.png).png).toEqual(sanitized.png);
  });

  it("refuses invalid checksums and trailing foreign bytes", () => {
    const broken = Buffer.from(fixture());
    broken[50]! ^= 1;
    expect(() => sanitizeAvatarPng(broken)).toThrow();
    expect(() => sanitizeAvatarPng(Buffer.concat([fixture(), Buffer.from("junk")]))).toThrow();
  });

  it("refuses oversized dimensions before inflating attacker data", () => {
    expect(() => sanitizeAvatarPng(fixture({ width: 1025 }))).toThrow();
    expect(() => sanitizeAvatarPng(fixture({ height: 1025 }))).toThrow();
  });

  it("refuses invalid scanline filters and missing image body", () => {
    expect(() => sanitizeAvatarPng(fixture({ filter: 5 }))).toThrow();
    expect(() => sanitizeAvatarPng(Buffer.alloc(100))).toThrow();
  });
});
