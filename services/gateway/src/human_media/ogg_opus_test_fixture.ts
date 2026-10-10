import {Buffer} from 'node:buffer';
/** Framing fixture with realistic packet durations; not a substitute for device codec proof. */
export function opusPage(packets:readonly Buffer[],seq:number,flags:number,granule:bigint):Buffer {
 const laces:number[]=[];for(const packet of packets){let size=packet.length;while(size>=255){laces.push(255);size-=255}laces.push(size)}
 if(laces.length>255)throw new Error('Fixture page too large');
 const payload=Buffer.concat(packets),bytes=Buffer.alloc(27+laces.length+payload.length);
 bytes.write('OggS',0,'ascii');bytes[5]=flags;bytes.writeBigUInt64LE(granule,6);
 bytes.writeUInt32LE(0xabc12342,14);bytes.writeUInt32LE(seq,18);bytes[26]=laces.length;
 Buffer.from(laces).copy(bytes,27);payload.copy(bytes,27+laces.length);
 let crc=0;for(const byte of bytes){crc=(crc^(byte<<24))>>>0;for(let i=0;i<8;i++)crc=(crc&0x80000000)?((crc<<1)^0x04c11db7)>>>0:(crc<<1)>>>0}
 bytes.writeUInt32LE(crc,22);return bytes;
}
export function validOpus({seconds=1}:{seconds?:number}={}):Buffer {
 const head=Buffer.alloc(19);head.write('OpusHead');head[8]=1;head[9]=1;head.writeUInt16LE(312,10);head.writeUInt32LE(48000,12);
 const tags=Buffer.alloc(16);tags.write('OpusTags');
 const end=BigInt(Math.round(seconds*48000)+312),count=Math.ceil(Number(end)/960);
 const pages=[opusPage([head],0,2,0n),opusPage([tags],1,0,0n)];
 for(let done=0;done<count;){const size=Math.min(100,count-done);done+=size;
  pages.push(opusPage(Array.from({length:size},()=>Buffer.from([0xf8,0xff,0xfe])),pages.length,done===count?4:0,done===count?end:BigInt(done*960)))}
 return Buffer.concat(pages);
}
