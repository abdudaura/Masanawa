/** Strict, bounded Ogg Opus container gate. Duration comes from the *media*, not client headers. */
export class InvalidVoiceNote extends Error {
  constructor(readonly code: string, readonly statusCode: number) { super(code); }
}
export const MAX_VOICE_BYTES = 1536 * 1024;
export const MAX_VOICE_DURATION_MS = 90_000;
const crcTable = Array.from({length:256},(_,n)=>{
  let v=(n<<24)>>>0;
  for(let i=0;i<8;i++)v=(v&0x80000000)?((v<<1)^0x04c11db7)>>>0:(v<<1)>>>0;
  return v>>>0;
});
function validCrc(bytes:Buffer,start:number,length:number):boolean {
  let crc=0;
  for(let i=0;i<length;i++){
    const b=(i>=22&&i<26)?0:bytes[start+i]!;
    crc=((crc<<8) ^ crcTable[((crc>>>24)^b)&0xff]!)>>>0;
  }
  return crc===bytes.readUInt32LE(start+22);
}
export function inspectOggOpus(bytes:Buffer):{durationMs:number;sizeBytes:number} {
  if(!Buffer.isBuffer(bytes)||bytes.length>MAX_VOICE_BYTES){
    throw new InvalidVoiceNote("messages.voice.too_large",413);
  }
  if(bytes.length<84)throw new InvalidVoiceNote("messages.voice.invalid_ogg",415);
  let offset=0,pages=0,serial:number|null=null,expectedSequence=0,lastGranule=-1n;
  let preSkip=0,eos=false,foundTags=false;
  while(offset<bytes.length){
    if(bytes.length-offset<27||bytes.toString("ascii",offset,offset+4)!=="OggS"||
       bytes[offset+4]!==0)throw new InvalidVoiceNote("messages.voice.invalid_ogg",415);
    const flags=bytes[offset+5]!;
    if((flags&~7)!==0)throw new InvalidVoiceNote("messages.voice.invalid_ogg",415);
    const segments=bytes[offset+26]!;
    if(offset+27+segments>bytes.length)throw new InvalidVoiceNote("messages.voice.invalid_ogg",415);
    let bodyLen=0;
    for(let n=0;n<segments;n++)bodyLen+=bytes[offset+27+n]!;
    const headerLen=27+segments,pageLen=headerLen+bodyLen;
    if(offset+pageLen>bytes.length||++pages>512||
       !validCrc(bytes,offset,pageLen))throw new InvalidVoiceNote("messages.voice.invalid_ogg",415);
    const streamSerial=bytes.readUInt32LE(offset+14);
    const seq=bytes.readUInt32LE(offset+18);
    if(serial===null){
      if(!(flags&2)||seq!==0||(flags&1)||segments<1)
        throw new InvalidVoiceNote("messages.voice.invalid_ogg",415);
      serial=streamSerial;
      const pos=offset+headerLen;
      if(bodyLen<19||bytes.toString("ascii",pos,pos+8)!=="OpusHead"||
         bytes[pos+8]!==1||bytes[pos+9]!==1||bytes[pos+18]!==0||
         bytes[offset+27]!==19)
        throw new InvalidVoiceNote("messages.voice.invalid_opus",415);
      preSkip=bytes.readUInt16LE(pos+10);
    } else {
      if(streamSerial!==serial||seq!==expectedSequence||((flags&2)!==0)||
         eos)throw new InvalidVoiceNote("messages.voice.invalid_ogg",415);
      if(pages===2){
        const pos=offset+headerLen;
        if(bodyLen<8||bytes.toString("ascii",pos,pos+8)!=="OpusTags")
          throw new InvalidVoiceNote("messages.voice.invalid_opus",415);
        foundTags=true;
      }
    }
    const granule=bytes.readBigUInt64LE(offset+6);
    if(granule!==0xffffffffffffffffn){
      if(granule<lastGranule)throw new InvalidVoiceNote("messages.voice.invalid_ogg",415);
      lastGranule=granule;
    }
    eos=Boolean(flags&4);
    expectedSequence++;
    offset+=pageLen;
  }
  if(!eos||!foundTags||pages<3||lastGranule<=BigInt(preSkip))
    throw new InvalidVoiceNote("messages.voice.invalid_ogg",415);
  const durationMs=Number((lastGranule-BigInt(preSkip))*1000n/48000n);
  if(durationMs<250||durationMs>MAX_VOICE_DURATION_MS)
    throw new InvalidVoiceNote("messages.voice.duration_invalid",400);
  return {durationMs,sizeBytes:bytes.length};
}
