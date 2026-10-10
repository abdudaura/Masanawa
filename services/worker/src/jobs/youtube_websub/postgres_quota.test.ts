import { describe, expect, it, vi } from "vitest";
import type { Pool } from "@masanawa/postgres";
import { createPostgresYouTubeQuota } from "./postgres_quota.js";
import { createYouTubeSyncRuntime } from "./runtime.js";

describe("YouTube cost and activation gates",()=>{
  it("starts with live network calls disabled and no API credential required",async()=>{
    const runtime=createYouTubeSyncRuntime({pool:{} as Pool,workerId:"youtube-worker",apiKey:undefined});
    expect(runtime.enabled).toBe(false);
    await expect(runtime.runOnce()).resolves.toEqual({claimed:0,acknowledged:0,retried:0,deadLetter:0});
  });
  it("rejects invalid daily limits before touching a database",()=>{
    expect(()=>createPostgresYouTubeQuota({} as Pool,{maxDailyUnits:0})).toThrow();
    expect(()=>createPostgresYouTubeQuota({} as Pool,{maxDailyUnits:10001})).toThrow();
  });
  it("reserves quota with one global UTC-day atomic query",async()=>{
    const query=vi.fn(async()=>({rowCount:1}));
    const quota=createPostgresYouTubeQuota({query} as unknown as Pool,{maxDailyUnits:500});
    expect(await quota.reserve("tenant-A",1)).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql,params]=query.mock.calls[0] as [string,unknown[]];
    expect(sql).toContain("ON CONFLICT (utc_day) DO UPDATE");
    expect(sql).toContain("clock_timestamp()");
    expect(params).toEqual([1,500]);
  });
  it("fails closed without budget or on invalid requested units",async()=>{
    const query=vi.fn(async()=>({rowCount:0}));
    const quota=createPostgresYouTubeQuota({query} as unknown as Pool,{maxDailyUnits:5});
    expect(await quota.reserve("tenant-A",1)).toBe(false);
    expect(await quota.reserve("tenant-A",6)).toBe(false);
    expect(await quota.reserve("",1)).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
