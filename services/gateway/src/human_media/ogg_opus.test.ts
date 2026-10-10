import { describe, expect, it } from "vitest";
import { inspectOggOpus, MAX_VOICE_BYTES, InvalidVoiceNote } from "./ogg_opus.js";
import { readFile } from "node:fs/promises";

import { validOpus,opusPage } from "./ogg_opus_test_fixture.js";
const audioPacket=()=>Buffer.from([0xf8,0xff,0xfe]);
const headers=()=>validOpus().subarray(0,91);
const stream=(packets:readonly Buffer[],granule=48312n,flags=4)=>Buffer.concat([headers(),opusPage(packets,2,flags,granule)]);
function unfinished(payload:Buffer,seq:number):Buffer {
 const page=opusPage([payload],seq,0,0xffffffffffffffffn);
 const result=Buffer.concat([page.subarray(0,28),page.subarray(29)]);result[26]=1;result.fill(0,22,26);
 let crc=0;for(const byte of result){crc=(crc^(byte<<24))>>>0;for(let n=0;n<8;n++)crc=(crc&0x80000000)?((crc<<1)^0x04c11db7)>>>0:(crc<<1)>>>0}result.writeUInt32LE(crc,22);return result;
}
describe("C04 Ogg Opus parser and 90s privacy bound",()=>{
 it("parses the stream granule rather than accepting a client-supplied duration",()=>{
  const opus=validOpus({seconds:15});
  expect(inspectOggOpus(opus)).toEqual({durationMs:15000,sizeBytes:opus.length});
 });
 it("rejects corruption, truncation, smuggled data, missing EOS and huge bodies",()=>{
  const opus=validOpus();
  for(const input of [
   opus.subarray(0,-1),
   Buffer.concat([opus,Buffer.from("trailing")]),
   (()=>{const o=Buffer.from(opus);o[40]=o[40]!^1;return o})(),
   Buffer.alloc(MAX_VOICE_BYTES+1),
  ])expect(()=>inspectOggOpus(input)).toThrow(InvalidVoiceNote);
 });
 it("rejects durations above the server limit",()=>{
  expect(()=>inspectOggOpus(validOpus({seconds:91}))).toThrow("messages.voice.duration_invalid");
 });
 it("rejects continuation without an unfinished packet and hidden BOS/EOS headers",()=>{
  const packets=Array.from({length:51},audioPacket);
  expect(()=>inspectOggOpus(stream(packets,48312n,5))).toThrow(InvalidVoiceNote);
  const head=validOpus().subarray(28,47);
  expect(()=>inspectOggOpus(Buffer.concat([opusPage([head,audioPacket()],0,2,0n),validOpus().subarray(47)]))).toThrow(InvalidVoiceNote);
 });
 it("rejects long decoder work hidden by a small final granule",()=>{
  // Every packet is 20ms, although a forged EOS says only one second.
  expect(()=>inspectOggOpus(stream(Array.from({length:200},audioPacket)))).toThrow(InvalidVoiceNote);
 });
 it("rejects invalid Opus frame count, framing lengths and padding",()=>{
  for(const invalid of [Buffer.from([0xfb,0]),Buffer.from([0xfb,8]),Buffer.from([0xf9,0]),
    Buffer.from([0xfa,252]),Buffer.from([0xfa,200,1]),Buffer.from([0xfb,0x41,255]),Buffer.alloc(1277,0xf8)]) {
   expect(()=>inspectOggOpus(stream([invalid,...Array.from({length:50},audioPacket)]))).toThrow(InvalidVoiceNote);
  }
 });
 it("bounds comment vendor and count fields before interpreting packets",()=>{
  const head=validOpus().subarray(0,47);
  for(const field of [8,12]) {
   const tags=Buffer.alloc(16);tags.write('OpusTags');tags.writeUInt32LE(0xffffffff,field);
   expect(()=>inspectOggOpus(Buffer.concat([head,opusPage([tags],1,0,0n),opusPage(Array.from({length:51},audioPacket),2,4,48312n)]))).toThrow(InvalidVoiceNote);
  }
 });
 it("accepts bounded CBR and VBR framing and legal zero-length DTX",()=>{
  for(const packet of [Buffer.from([0xf9,0xff,0xfe,0xff,0xfe]),Buffer.from([0xfa,2,0xff,0xfe,0xff,0xfe]),
   Buffer.from([0xfb,2,0xff,0xfe,0xff,0xfe]),Buffer.from([0xfb,0x82,2,0xff,0xfe,0xff,0xfe]),Buffer.from([0xf8])]) {
   const samples=packet[0]===0xf8?960:1920,count=Math.ceil(48312/samples);
   expect(inspectOggOpus(stream(Array.from({length:count},()=>packet))).durationMs).toBe(1000);
  }
 });
 it("rejects incomplete final packets even when the page CRC is correct",()=>{
  const packet=Buffer.alloc(255,0xff);packet[0]=0xf8;
  const page=opusPage([packet],2,4,48312n);
  // Drop terminating zero lace and rebuild correct CRC rather than relying on CRC rejection.
  const damaged=Buffer.concat([page.subarray(0,28),page.subarray(29)]);damaged[26]=1;damaged.fill(0,22,26);
  let crc=0;for(const byte of damaged){crc=(crc^(byte<<24))>>>0;for(let n=0;n<8;n++)crc=(crc&0x80000000)?((crc<<1)^0x04c11db7)>>>0:(crc<<1)>>>0}damaged.writeUInt32LE(crc,22);
  expect(()=>inspectOggOpus(Buffer.concat([headers(),damaged]))).toThrow(InvalidVoiceNote);
 });
 it("reassembles a valid audio packet across pages and requires its continuation flag",()=>{
  const packet=Buffer.alloc(601,0xff);packet[0]=0xf8;
  const before=Buffer.concat([headers(),unfinished(packet.subarray(0,255),2)]);
  const tail=[packet.subarray(255),...Array.from({length:50},audioPacket)];
  expect(inspectOggOpus(Buffer.concat([before,opusPage(tail,3,5,48312n)])).durationMs).toBe(1000);
  expect(()=>inspectOggOpus(Buffer.concat([before,opusPage(tail,3,4,48312n)]))).toThrow(InvalidVoiceNote);
 });
 it("permits a bounded comments packet spanning pages without treating it as audio",()=>{
  const tags=Buffer.alloc(316);tags.write('OpusTags');tags.writeUInt32LE(300,8);
  const recorded=Buffer.concat([validOpus().subarray(0,47),unfinished(tags.subarray(0,255),1),
   opusPage([tags.subarray(255)],2,1,0n),opusPage(Array.from({length:51},audioPacket),3,4,48312n)]);
  expect(inspectOggOpus(recorded).durationMs).toBe(1000);
 });
 it.runIf(Boolean(process.env.MASANAWA_C04_REAL_OGG))("validates actual independently encoded mono Ogg rather than only synthetic fixtures",async()=>{
  const recorded=await readFile(process.env.MASANAWA_C04_REAL_OGG!);
  expect(inspectOggOpus(recorded)).toEqual({durationMs:1000,sizeBytes:recorded.length});
 });
});
