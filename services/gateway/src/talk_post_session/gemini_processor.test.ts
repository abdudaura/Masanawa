import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { ReplayMediaRepository } from "../talk_replay/egress/postgres_media_repository.js";
import type { ReplayObjectStore } from "../talk_replay/playback/s3_object_store.js";
import { createGeminiReplayInsightProcessor } from "./gemini_processor.js";
import type { ReplayInsightSource } from "./model.js";

const audio = Buffer.from("OggS-safe-voice-recording", "utf8");
const sha = createHash("sha256").update(audio).digest("hex");
const source: ReplayInsightSource = {
  tenantId:"tenant-a",talkId:"talk_1",recordingId:"recording_1",
  checksumSha256:sha,replayRevision:3,hostUserId:"host",
};
function fixture(override: {audio?:Buffer; deny?:boolean} = {}) {
  const media = {
    current: vi.fn(async () => ({
      status:"ready", checksumSha256:sha, objectKey:"talk-replays/tenant-a/talk_1/recording_1.ogg",
    })),
    playbackObject: vi.fn(async () => override.deny ? null : ({
      objectKey:"talk-replays/tenant-a/talk_1/recording_1.ogg",
    })),
  } as unknown as ReplayMediaRepository;
  const objects = { presignGet: vi.fn(async () => ({
    url:"https://storage.example/bucket/audio.ogg?X-Amz-Signature=abc",
    expiresAt:"2026-10-09T01:00:00Z",
  })) } as unknown as ReplayObjectStore;
  const network = vi.fn(async (_url: string | URL | Request) => {
    if (network.mock.calls.length === 1) return new Response(new Uint8Array(override.audio ?? audio));
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({
      summary:"Host draft",highlights:["Safe summary"],nextTalkTitle:null,
    })}]}}]});
  });
  const processor = createGeminiReplayInsightProcessor({
    media,objects,
    credentials:{apiKeys:["secret-for-test"],models:["gemini-test-model"]},
    objectOrigin:"https://storage.example/",
    fetchImpl:network as unknown as typeof fetch,
  });
  return {processor,network,media,objects};
}
describe("U16 real provider adapter safety boundary",()=>{
  it("verifies actual OGG checksum, fetches R13-authorized media, calls Gemini with structured draft only",async()=>{
    const f=fixture();
    expect(await f.processor.generate(source,AbortSignal.timeout(1000))).toEqual({
      summary:"Host draft",highlights:["Safe summary"],nextTalkTitle:null,
    });
    expect(f.network).toHaveBeenCalledTimes(2);
    expect(f.media.playbackObject).toHaveBeenCalledWith({
      tenantId:"tenant-a",talkId:"talk_1",viewerUserId:"host",
    });
    const modelRequest=f.network.mock.calls[1] as unknown as [unknown,RequestInit];
    const body=JSON.parse(modelRequest[1].body as string);
    expect(body.contents[0].parts[1].inlineData.mimeType).toBe("audio/ogg");
    expect(body.contents[0].parts[1].inlineData.data).toBe(audio.toString("base64"));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });
  it("never sends tampered recorded bytes to a provider",async()=>{
    const f=fixture({audio:Buffer.from("OggS-bad-checksum")});
    await expect(f.processor.generate(source,AbortSignal.timeout(1000)))
      .rejects.toThrow("media_integrity_failed");
    expect(f.network).toHaveBeenCalledTimes(1);
  });
  it("never downloads media when the R13 authorization is revoked",async()=>{
    const f=fixture({deny:true});
    await expect(f.processor.generate(source,AbortSignal.timeout(1000)))
      .rejects.toThrow("replay_unavailable");
    expect(f.network).not.toHaveBeenCalled();
  });
  it("refuses objects larger than the bounded audio budget",async()=>{
    const f=fixture({audio:Buffer.alloc(8*1024*1024+1,2)});
    await expect(f.processor.generate(source,AbortSignal.timeout(1000)))
      .rejects.toThrow("media_too_large");
    expect(f.network).toHaveBeenCalledTimes(1);
  });
});
