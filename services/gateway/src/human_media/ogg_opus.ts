/** Bounded single-stream mono Ogg Opus gate. RFC 7845 §§3–5 and RFC 6716 §3.2.
 * Packet framing/TOC duration are checked; this is not a full entropy decoder or antivirus scan. */
export class InvalidVoiceNote extends Error {
 constructor(readonly code:string,readonly statusCode:number){super(code)}
}
export const MAX_VOICE_BYTES=1536*1024;
export const MAX_VOICE_DURATION_MS=90_000;
const invalid=(opus=false):never=>{throw new InvalidVoiceNote(opus?'messages.voice.invalid_opus':'messages.voice.invalid_ogg',415)};
const crcTable=Array.from({length:256},(_,n)=>{let v=(n<<24)>>>0;for(let i=0;i<8;i++)v=(v&0x80000000)?((v<<1)^0x04c11db7)>>>0:(v<<1)>>>0;return v});
function validCrc(bytes:Buffer,start:number,length:number):boolean {
 let crc=0;for(let i=0;i<length;i++){const b=i>=22&&i<26?0:bytes[start+i]!;crc=((crc<<8)^crcTable[((crc>>>24)^b)&255]!)>>>0}
 return crc===bytes.readUInt32LE(start+22);
}
/** Validate frame packing before counting decoder work; zero-byte DTX frames are legal. */
function packetSamples(packet:Buffer):number {
 if(!packet.length)return invalid(true);
 const toc=packet[0]!,config=toc>>3,code=toc&3;
 const frameSamples=config>=16?120*(1<<(config&3)):config>=12?480*(1<<(config&1)):[480,960,1920,2880][config&3]!;
 let frames=code===0?1:2,index=1,end=packet.length;
 const length=()=>{if(index>=end)return invalid(true);const first=packet[index++]!;if(first<252)return first;if(index>=end)return invalid(true);return first+4*packet[index++]!};
 if(code===0){if(end-1>1275)return invalid(true)}
 else if(code===1){if((end-1)%2||((end-1)/2)>1275)return invalid(true)}
 else if(code===2){const first=length(),remaining=end-index;if(first>remaining||remaining-first>1275)return invalid(true)}
 else {
  if(index>=end)return invalid(true);
  const control=packet[index++]!;frames=control&63;
  if(!frames||frames*frameSamples>5760)return invalid(true);
  if(control&64){let padding=0,value;do{if(index>=end)return invalid(true);value=packet[index++]!;padding+=value===255?254:value}while(value===255);end-=padding;if(end<index)return invalid(true)}
  if(control&128){let used=0;for(let i=0;i<frames-1;i++)used+=length();const last=end-index-used;if(last<0||last>1275)return invalid(true)}
  else if((end-index)%frames||((end-index)/frames)>1275)return invalid(true);
 }
 const samples=frameSamples*frames;if(samples>5760)return invalid(true);return samples;
}
function tags(packet:Buffer):void {
 if(packet.length<16||packet.toString('ascii',0,8)!=='OpusTags')return invalid(true);
 let index=12+packet.readUInt32LE(8);if(index+4>packet.length)return invalid(true);
 const count=packet.readUInt32LE(index);index+=4;
 if(count>Math.floor((packet.length-index)/4))return invalid(true);
 for(let i=0;i<count;i++){if(index+4>packet.length)return invalid(true);const size=packet.readUInt32LE(index);index+=4+size;if(index>packet.length)return invalid(true)}
 // RFC 7845 permits trailing comment padding; no strings are interpreted or rendered.
}
export function inspectOggOpus(bytes:Buffer):{durationMs:number;sizeBytes:number} {
 if(!Buffer.isBuffer(bytes)||bytes.length>MAX_VOICE_BYTES)throw new InvalidVoiceNote('messages.voice.too_large',413);
 if(bytes.length<84)return invalid();
 let offset=0,pages=0,serial:number|null=null,sequence=0,packetCount=0,preSkip=0,eos=false;
 let fragments:Buffer[]=[],pending=0,totalSamples=0n,lastAudioGranule=0n,initialOffset:bigint|null=null,lastPacketSamples=0;
 const unknown=0xffffffffffffffffn;
 while(offset<bytes.length){
  if(eos||bytes.length-offset<27||bytes.toString('ascii',offset,offset+4)!=='OggS'||bytes[offset+4]!==0)return invalid();
  const flags=bytes[offset+5]!,segments=bytes[offset+26]!;
  if((flags&~7)!==0||offset+27+segments>bytes.length||Boolean(flags&1)!==Boolean(pending))return invalid();
  let bodyLen=0;for(let i=0;i<segments;i++)bodyLen+=bytes[offset+27+i]!;
  const headerLen=27+segments,pageLen=headerLen+bodyLen;
  if(offset+pageLen>bytes.length||++pages>512||!validCrc(bytes,offset,pageLen))return invalid();
  const stream=bytes.readUInt32LE(offset+14),seq=bytes.readUInt32LE(offset+18),granule=bytes.readBigUInt64LE(offset+6);
  if(serial===null){if(flags!==2||seq!==0||segments!==1||bytes[offset+27]!==19||granule!==0n)return invalid();serial=stream}
  else if(stream!==serial||seq!==sequence||(flags&2))return invalid();
  let position=offset+headerLen,audioCompleted=0,headerCompleted=false;
  for(let i=0;i<segments;i++){
   const size=bytes[offset+27+i]!;fragments.push(bytes.subarray(position,position+size));pending+=size;position+=size;
   if(size===255)continue;
   const packet=Buffer.concat(fragments,pending);fragments=[];pending=0;
   if(packetCount===0){
    if(packet.length!==19||packet.toString('ascii',0,8)!=='OpusHead'||packet[8]!==1||packet[9]!==1||packet[18]!==0)return invalid(true);
    preSkip=packet.readUInt16LE(10);headerCompleted=true;
   }else if(packetCount===1){tags(packet);headerCompleted=true;if(i!==segments-1)return invalid(true)}
   else {lastPacketSamples=packetSamples(packet);totalSamples+=BigInt(lastPacketSamples);audioCompleted++;
    // End trimming or fabricated granules cannot hide unbounded decoder work.
    if(totalSamples>BigInt(90*48000+preSkip+5760))throw new InvalidVoiceNote('messages.voice.duration_invalid',400);
   }
   packetCount++;
  }
  eos=Boolean(flags&4);
  if(headerCompleted&&granule!==0n)return invalid();
  if(audioCompleted){
   if(granule===unknown)return invalid();
   if(initialOffset===null){if(!eos&&granule<totalSamples)return invalid();initialOffset=granule>totalSamples?granule-totalSamples:0n}
   const expected=initialOffset+totalSamples;
   if(granule<lastAudioGranule||granule>expected||(!eos&&granule!==expected)||
      (eos&&expected-granule>BigInt(lastPacketSamples)))return invalid();
   lastAudioGranule=granule;
  }else if(!headerCompleted&&granule!==unknown)return invalid();
  if(eos&&(pending||!audioCompleted))return invalid();
  sequence++;offset+=pageLen;
 }
 if(!eos||packetCount<3||initialOffset===null||lastAudioGranule<=initialOffset+BigInt(preSkip))return invalid();
 const durationMs=Number((lastAudioGranule-initialOffset-BigInt(preSkip))*1000n/48000n);
 if(durationMs<250||durationMs>MAX_VOICE_DURATION_MS)throw new InvalidVoiceNote('messages.voice.duration_invalid',400);
 return {durationMs,sizeBytes:bytes.length};
}
