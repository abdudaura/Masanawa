import {describe,expect,it,vi} from "vitest";
import type {Pool} from "@masanawa/postgres";
import {createPostgresLeaseRequestRecorder} from "./postgres_lease.js";
describe("YouTube lease persistence",()=>{
  it("matches tenant+source and rejects stale permissions",async()=>{
    const query=vi.fn(async(_sql:string,_args:unknown[])=>({rowCount:0}));
    const mark=createPostgresLeaseRequestRecorder({query} as unknown as Pool);
    await expect(mark("tenant-1","source-1")).rejects.toMatchObject({code:"not_authorized"});
    expect(query.mock.calls[0]![1]).toEqual(["tenant-1","source-1"]);
  });
  it("never calls the database for an empty source",async()=>{
    const query=vi.fn();
    const mark=createPostgresLeaseRequestRecorder({query} as unknown as Pool);
    await expect(mark("tenant-1","")).rejects.toMatchObject({code:"invalid_source"});
    expect(query).not.toHaveBeenCalled();
  });
});
