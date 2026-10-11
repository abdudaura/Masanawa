import {describe,expect,it,vi} from "vitest";
import {runYoutubeOutboxBatch} from "./outbox_runner.js";
import type {Pool} from "@masanawa/postgres";
/** Database integration proof belongs to a disposable PG18 runner; this
 * seam test checks that an empty queue never invokes a provider. */
describe("YouTube canonical outbox runner",()=>{
  it("does not invoke provider without a claimed event",async()=>{
    // claimOutboxBatch is exercised by PostgreSQL integration tests; this
    // scoped regression uses an in-memory query result from the exact
    // canonical claim SQL rather than a second queue implementation.
    const query=vi.fn(async()=>({rows:[]}));
    const pool={connect:async()=>({query,release:()=>{}})} as unknown as Pool;
    const load=vi.fn(),reconcile=vi.fn();
    const result=await runYoutubeOutboxBatch({pool,workerId:"w1",loadSource:load,reconcile});
    expect(result).toEqual({claimed:0,acknowledged:0,retried:0,deadLetter:0});
    expect(load).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
  });
});
