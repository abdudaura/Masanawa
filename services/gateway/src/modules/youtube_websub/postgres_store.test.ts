import { describe, expect, it, vi } from "vitest";
import { createPostgresYouTubeWebSubStore } from "./postgres_store.js";
import type { Pool } from "@masanawa/postgres";
describe("WebSub credential lookup never uses the raw callback token as SQL",()=>{
  it("uses a hashed lookup key and retrieves an isolated secret by reference",async()=>{
    const queried:unknown[][]=[];
    const pool={query:vi.fn(async(_sql:string, params:unknown[])=>{
      queried.push(params);
      return {rows:[{tenant_id:"tenant_TEST",source_id:"s",channel_id:"UC"+"X".repeat(22),
        credential_ref:"server-secret-ref",enabled:true,authorized:true}]};
    })} as unknown as Pool;
    const secret=vi.fn(async()=>"x".repeat(40));
    const store=createPostgresYouTubeWebSubStore({pool,resolveSignatureSecret:secret});
    const result=await store.findByCallbackToken("a".repeat(48));
    expect(queried[0]![0]).toMatch(/^[a-f0-9]{64}$/u);
    expect(queried[0]![0]).not.toBe("a".repeat(48));
    expect(secret).toHaveBeenCalledWith("server-secret-ref");
    expect(result?.signatureSecret).toHaveLength(40);
  });
});
