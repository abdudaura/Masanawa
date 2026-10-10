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
        calls.push({url:String(url),...(init === undefined ? {} : {init})});
        return new Response(bytes,{status:200,headers:{"content-length":String(bytes.byteLength)}});
      },
    });
    const digest=await store.checksumSha256("talk-replays/talk/replay.ogg");
    expect(digest).toBe(createHash("sha256").update(bytes).digest("hex"));
    const headers=calls[0]?.init?.headers as Record<string,string>;
    expect(headers.authorization).toContain("AWS4-HMAC-SHA256 Credential=access/");
    expect(calls[0]?.url).toContain("/private/talk-replays/talk/replay.ogg");
  });

  it("retries boundedly while a just-stopped egress object becomes visible",async()=>{
    let attempts=0;
    const delays:number[]=[];
    const bytes=new TextEncoder().encode("ready");
    const store=createReplayObjectStore({
      endpoint:"https://s3.example.test",
      region:"test",
      bucket:"private",
      accessKey:"access",
      secret:"0123456789abcdef",
      availabilityAttempts:3,
      availabilityDelayMs:10,
      sleep:async milliseconds=>{delays.push(milliseconds);},
      fetchImpl:async()=>{
        attempts+=1;
        return attempts<3
          ? new Response(null,{status:404})
          : new Response(bytes,{status:200,headers:{"content-length":String(bytes.byteLength)}});
      },
    });
    await expect(store.checksumSha256("talk-replays/talk/replay.ogg"))
      .resolves.toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(attempts).toBe(3);
    expect(delays).toEqual([10,20]);
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
