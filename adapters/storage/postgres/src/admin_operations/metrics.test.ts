import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { createPostgresAdminOperationsMetrics } from "./metrics.js";

describe("A01 tenant-fenced canonical outbox/reconciliation metrics", () => {
  it("reads only the authenticated tenant and keeps uninstrumented signals unknown", async () => {
    const query=vi.fn(async (sql:string,values:readonly unknown[]) => {
      expect(values).toEqual(["tenant_alpha"]);
      if(sql.includes("FROM events.outbox")) {
        return {rows:[{pending_jobs:"6",active_leases:"2",dead_letters:"1",oldest_seconds:"42"}]};
      }
      if(sql.includes("FROM events.reconciliation_cases")) return {rows:[{cases:"3"}]};
      throw new Error("unknown table");
    });
    const result=await createPostgresAdminOperationsMetrics({query} as unknown as Pool).read("tenant_alpha");
    expect(query).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({pendingJobs:6,activeJobLeases:2,deadLetters:1,
      oldestPendingSeconds:42,openFinancialReconciliation:3});
    expect(result.roomAnswerAgeSeconds).toBeNull();
    expect(result.entitlementErrors).toBeNull();
  });
  it("does not turn missing instrumentation into fabricated nonzero values",async()=>{
    const query=vi.fn(async (sql:string) => sql.includes("events.outbox")
      ? {rows:[{pending_jobs:"0",active_leases:"0",dead_letters:"0",oldest_seconds:null}]}
      : {rows:[{cases:"0"}]});
    const result=await createPostgresAdminOperationsMetrics({query} as unknown as Pool).read("tenant_beta");
    expect(result.oldestPendingSeconds).toBeNull();
    expect(result.pendingJobs).toBe(0);
    expect(result.externalSyncLagSeconds).toBeNull();
    expect(result.budgetWarnings).toBeNull();
  });
  it("fails rather than presenting zero when canonical journal database is offline",async()=>{
    const query=vi.fn(async()=>{throw new Error("postgres down")});
    await expect(createPostgresAdminOperationsMetrics({query} as unknown as Pool).read("tenant_alpha"))
      .rejects.toThrow("postgres down");
  });
});
