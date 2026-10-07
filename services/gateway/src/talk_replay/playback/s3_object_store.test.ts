import { createHash } from "node:crypto";
import { describe,expect,it } from "vitest";
import { createReplayObjectStore } from "./s3_object_store.js";

describe("Replay private object store",()=>{
  it("hashes the private object using signed S3 GET",async()=>{
    const calls:Array<{url:string;init?:RequestInit}>=[];
    const bytes=new TextEncoder().encode("recorded-audio");
    const store=createReplayObjectStore({
      endpoint:"https://ams3.digitaloceanspaces.com",
      region:"ams3",
      bucket:"private",
      accessKey:"access",
      secret:"0123456789abcdef",
      now:()=>new Date("2026-10-07T10:00:00.000Z"),
      fetchImpl:async(url,init)=>{
        calls.push({url:String(url),init});
        return new Response(bytes,{status:200,headers:{"content-length":String(bytes.byteLength)}});
      },
    });
    const digest=await store.checksumSha256("talk-replays/talk/replay.ogg");
    expect(digest).toBe(createHash("sha256").update(bytes).digest("hex"));
    const headers=calls[0]?.init?.headers as Record<string,string>;
    expect(headers.authorization).toContain("AWS4-HMAC-SHA256 Credential=access/");
    expect(calls[0]?.url).toContain("/private/talk-replays/talk/replay.ogg");
  });

  it("creates a short-lived SigV4 URL without exposing the secret",async()=>{
    const store=createReplayObjectStore({
      endpoint:"https://ams3.digitaloceanspaces.com",
      region:"ams3",bucket:"private",accessKey:"access",secret:"0123456789abcdef",
      now:()=>new Date("2026-10-07T10:00:00.000Z"),
    });
    const signed=await store.presignGet("talk-replays/talk/replay.ogg",300);
    expect(signed.url).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
    expect(signed.url).toContain("X-Amz-Expires=300");
    expect(signed.url).not.toContain("0123456789abcdef");
    expect(signed.expiresAt).toBe("2026-10-07T10:05:00.000Z");
  });

  it("deletes discarded replay objects with signed DELETE",async()=>{
    let method:string|undefined;
    const store=createReplayObjectStore({
      endpoint:"https://s3.example.test",region:"test",bucket:"private",accessKey:"access",secret:"0123456789abcdef",
      fetchImpl:async(_url,init)=>{method=init?.method;return new Response(null,{status:204});},
    });
    await store.deleteObject("talk-replays/talk/replay.ogg");
    expect(method).toBe("DELETE");
  });
});
