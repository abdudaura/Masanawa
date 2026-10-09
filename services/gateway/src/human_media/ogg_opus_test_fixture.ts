import { Buffer } from 'node:buffer';
// Generates only a bounded test fixture. Production stores real recorder bytes.
function page(payload:Buffer,seq:number,flags:number,granule:bigint):Buffer {
 const bytes=Buffer.alloc(28+payload.length);
 bytes.write("OggS",0,"ascii");bytes[4]=0;bytes[5]=flags;
 bytes.writeBigUInt64LE(granule,6);bytes.writeUInt32LE(0xabc12342,14);
 bytes.writeUInt32LE(seq,18);bytes[26]=1;bytes[27]=payload.length;
 payload.copy(bytes,28);
 let crc=0;
 for(let n=0;n<bytes.length;n++){
  crc=(crc^((bytes[n]??0)<<24))>>>0;
  for(let j=0;j<8;j++)crc=(crc&0x80000000)?((crc<<1)^0x04c11db7)>>>0:(crc<<1)>>>0;
 }
 bytes.writeUInt32LE(crc,22);
 return bytes;
}
export function validOpus({seconds=1}:{seconds?:number}={}):Buffer {
 const head=Buffer.alloc(19);head.write("OpusHead");head[8]=1;head[9]=1;
 head.writeUInt16LE(312,10);head.writeUInt32LE(48000,12);head[18]=0;
 const tags=Buffer.alloc(16);tags.write("OpusTags");
 return Buffer.concat([
  page(head,0,2,0n),
  page(tags,1,0,0xffffffffffffffffn),
  page(Buffer.from([0xf8,0xff,0xfe]),2,4,BigInt(seconds*48000+312)),
 ]);
}
