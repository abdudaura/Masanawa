import { describe, expect, it } from "vitest";
import { inspectOggOpus, MAX_VOICE_BYTES, InvalidVoiceNote } from "./ogg_opus.js";

import { validOpus } from "./ogg_opus_test_fixture.js";
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
});
