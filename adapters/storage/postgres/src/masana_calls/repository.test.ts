import {describe,it,expect,vi} from "vitest";
import {createPostgresMasanaCallStore} from "./repository.js";
describe("J04 call PostgreSQL authorization and lifecycle",()=>{
  it("checks approved voice + platform + active fan with exact tenant scope",async()=>{
    const query=vi.fn(async (_sql:string,_params:unknown[])=>({rows:[{ok:true}]}));
    const store=createPostgresMasanaCallStore({query} as never);
    expect(await store.qualified({tenantId:"tenant-a",fanUserId:"fan-a",characterId:"c"})).toBe(true);
    expect(query.mock.calls[0]![0]).toContain("o.kind='platform'");
    expect(query.mock.calls[0]![0]).toContain("r.voice_profile_id");
    expect(query.mock.calls[0]![1]).toEqual(["tenant-a","fan-a","c"]);
  });
  it("binds fan on every sensitive query, not caller-supplied user",async()=>{
    const query=vi.fn(async (_sql:string,_params:unknown[])=>({rows:[]}));
    const store=createPostgresMasanaCallStore({query} as never);
    await store.get({tenantId:"tenant-a",fanUserId:"fan-a",callId:"call-a"});
    await store.markActive({tenantId:"tenant-a",fanUserId:"fan-a",callId:"call-a"});
    await store.finish({tenantId:"tenant-a",fanUserId:"fan-a",callId:"call-a",state:"ended"});
    for(const call of query.mock.calls) {
      expect(call[0]).toContain("tenant_id=$1");
      expect(call[0]).toContain("fan_user_id=$2");
      expect(call[1]?.slice(0,3)).toEqual(["tenant-a","fan-a","call-a"]);
    }
  });
  it("leases and acknowledges pending shutdown by tenant and call only",async()=>{
    const query=vi.fn(async (_sql:string,_params:unknown[])=>({rows:[]}));
    const store=createPostgresMasanaCallStore({query} as never);
    await store.claimPendingStops(20);
    expect(query.mock.calls[0]![0]).toContain("SKIP LOCKED");
    expect(query.mock.calls[0]![0]).toContain("provider_stop_pending");
    await store.ackStop({tenantId:"tenant-a",callId:"call-a"});
    expect(query.mock.calls[1]![1]).toEqual(["tenant-a","call-a"]);
    expect(query.mock.calls[1]![0]).toContain("provider_stop_pending=false");
  });
  it("claims expired calls atomically and avoids duplicate stop",async()=>{
    const query=vi.fn(async (_sql:string,_params:unknown[])=>({rows:[{callId:"call-a",roomName:"masana-a"}]}));
    const store=createPostgresMasanaCallStore({query} as never);
    expect(await store.claimExpired(40)).toHaveLength(1);
    expect(query.mock.calls[0]![0]).toContain("SKIP LOCKED");
    expect(query.mock.calls[0]![0]).toContain("state='expired'");
  });
});
