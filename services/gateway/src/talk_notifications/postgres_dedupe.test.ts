import { describe, expect, it } from "vitest";
import {
  createPostgresTalkPushDedupeRepository,
  type TalkPushDedupeSqlPool,
} from "./postgres_dedupe.js";

describe("Postgres Talk push dedupe", () => {
  it("claims a recipient event atomically and calculates bounded retention", async () => {
    const calls: Array<{text:string;values?:unknown[]}> = [];
    const pool:TalkPushDedupeSqlPool = {
      async query<Row>(text:string, values?:unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        return {
          rowCount:1,
          rows:[{dedupe_key:"talk-push:v1:t:u:event-1"}] as unknown as Row[],
        };
      },
    };
    const repository=createPostgresTalkPushDedupeRepository(pool,{retentionDays:30});

    await expect(repository.claim({
      tenantId:"tenant-1",
      userId:"user-1",
      dedupeKey:"talk-push:v1:t:u:event-1",
      createdAt:"2026-10-07T10:00:00Z",
    })).resolves.toBe(true);

    expect(calls[0]?.text).toContain("ON CONFLICT(tenant_id,user_id,dedupe_key) DO NOTHING");
    expect(calls[0]?.values).toEqual([
      "tenant-1",
      "user-1",
      "talk-push:v1:t:u:event-1",
      "2026-10-07T10:00:00.000Z",
      "2026-11-06T10:00:00.000Z",
    ]);
  });

  it("returns false for a duplicate claim without inventing a second delivery identity", async () => {
    const pool:TalkPushDedupeSqlPool = {
      async query<Row>() {
        return {rowCount:0,rows:[] as Row[]};
      },
    };
    const repository=createPostgresTalkPushDedupeRepository(pool);

    await expect(repository.claim({
      tenantId:"tenant-1",
      userId:"user-1",
      dedupeKey:"talk-push:v1:t:u:event-1",
      createdAt:"2026-10-07T10:00:00Z",
    })).resolves.toBe(false);
  });

  it("purges only expired claims in a bounded batch", async () => {
    let call:{text:string;values?:unknown[]}|undefined;
    const pool:TalkPushDedupeSqlPool = {
      async query<Row>(text:string,values?:unknown[]) {
        call={ text, ...(values === undefined ? {} : { values }) };
        return {
          rowCount:2,
          rows:[
            {dedupe_key:"a"},
            {dedupe_key:"b"},
          ] as unknown as Row[],
        };
      },
    };
    const repository=createPostgresTalkPushDedupeRepository(pool);

    await expect(repository.purgeExpired({
      before:"2026-11-07T00:00:00Z",
      limit:250,
    })).resolves.toBe(2);

    expect(call?.text).toContain("WHERE expires_at <= $1");
    expect(call?.text).toContain("LIMIT $2");
    expect(call?.values).toEqual(["2026-11-07T00:00:00.000Z",250]);
  });

  it("rejects malformed identities, timestamps and unbounded retention/cleanup", async () => {
    const pool:TalkPushDedupeSqlPool = {
      async query<Row>() {
        return {rowCount:0,rows:[] as Row[]};
      },
    };
    expect(() => createPostgresTalkPushDedupeRepository(pool,{retentionDays:0}))
      .toThrow("retentionDays");

    const repository=createPostgresTalkPushDedupeRepository(pool);
    await expect(repository.claim({
      tenantId:"",
      userId:"user-1",
      dedupeKey:"key",
      createdAt:"2026-10-07T10:00:00Z",
    })).rejects.toThrow("tenantId");

    await expect(repository.claim({
      tenantId:"tenant-1",
      userId:"user-1",
      dedupeKey:"key",
      createdAt:"not-a-date",
    })).rejects.toThrow("createdAt");

    await expect(repository.purgeExpired({
      before:"2026-11-07T00:00:00Z",
      limit:10001,
    })).rejects.toThrow("limit");
  });
});
