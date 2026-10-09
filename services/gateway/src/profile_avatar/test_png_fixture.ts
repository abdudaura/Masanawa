import { deflateSync } from "node:zlib";

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
export function validAvatarPng(input?: Readonly<{
  width?: number; height?: number; filter?: number;
  metadata?: boolean;
}>): Buffer {
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
