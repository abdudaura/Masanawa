import { describe, expect, it, vi } from "vitest";
import { createPostgresReplayInsightRepository, type InsightSqlPool } from "./postgres_repository.js";

describe("U16 Postgres privacy and compare-and-set", () => {
  it("requires host, R13 ready media, recording consent, finalization and safety visibility", async () => {
    const queries: string[] = [];
    const pool: InsightSqlPool = { async query<Row>(sql, values) {
      queries.push(sql);
      expect(values).toEqual(["tenant-a","host","talk_1"]);
      return { rows: [] as Row[], rowCount: 0 };
    } };
    const output = await createPostgresReplayInsightRepository(pool).source("tenant-a","host","talk_1");
    expect(output).toBeNull();
    const sql=queries[0]!;
    expect(sql).toContain("t.host_user_id=$2");
    expect(sql).toContain("m.status='ready'");
    expect(sql).toContain("r.recording_state='finalized'");
    expect(sql).toContain("hostRecordingConsent");
    expect(sql).toContain("talks.safety_enforcement");
  });
  it("leases only matching verified media checksum; CAS update rechecks replay", async () => {
    const query = vi.fn(async <Row extends Record<string, unknown>>(sql: string) => ({
      rows: [] as Row[], rowCount: 1,
    }));
    const repo=createPostgresReplayInsightRepository({query});
    const source = {tenantId:"tenant-a",talkId:"talk_1",recordingId:"recording_1",checksumSha256:"a".repeat(64),replayRevision:4};
    expect(await repo.claim(source,"host","lease-1")).toBe(true);
    expect(query.mock.calls[0]![0]).toContain("ON CONFLICT(tenant_id,talk_id)");
    expect(query.mock.calls[0]![0]).toContain("lease_until < now()");
    expect(await repo.complete({source,leaseToken:"lease-1"}, {
      summary:"safe",highlights:[],nextTalkTitle:null,
    })).toBe(true);
    expect(query.mock.calls[1]![0]).toContain("lease_token=$5");
    expect(query.mock.calls[1]![0]).toContain("talks.safety_enforcement");
    expect(query.mock.calls[1]![0]).toContain("m.status='ready'");
  });
  it("never returns previous text after a replay is blocked or changed", async () => {
    const pool: InsightSqlPool = { async query<Row>(sql) {
      expect(sql).toContain("allowed.recording_id=i.recording_id");
      expect(sql).toContain("allowed.checksum_sha256=i.media_checksum");
      return {rows:[] as Row[],rowCount:0};
    }};
    expect(await createPostgresReplayInsightRepository(pool).read("tenant-a","host","talk_1"))
      .toBeNull();
  });
});
