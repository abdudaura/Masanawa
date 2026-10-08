import { describe, expect, it, vi } from "vitest";
import {
  createPostgresReplayMediaRepository,
  type ReplayMediaSqlPool,
} from "./postgres_media_repository.js";

const identity = {
  tenantId: "tenant_1", talkId: "talk_1", recordingId: "recording_1",
  checksumSha256: "f".repeat(64),
  completedAt: "2026-10-07T10:00:10.000Z",
};

function fixture(affected: number) {
  const query = vi.fn(async (_sql: string, _params?: unknown[]) =>
    ({ rows: [], rowCount: affected }));
  const repository = createPostgresReplayMediaRepository(
    { query } as unknown as ReplayMediaSqlPool,
  );
  return { repository, query };
}

describe("R13 media readiness CAS", () => {
  it("only marks previously stopped job with exact stop time ready", async () => {
    const f = fixture(1);
    await f.repository.markReady(identity);
    expect(f.query).toHaveBeenCalledTimes(1);
    const [sql, params] = f.query.mock.calls[0]!;
    expect(sql).toContain("SET status='ready',checksum_sha256=$4");
    expect(sql).toContain("AND status='stopped' AND completed_at=$5::timestamptz");
    expect(sql).not.toContain("SET status='ready',checksum_sha256=$4,completed_at=");
    expect(params).toEqual([
      identity.tenantId, identity.talkId, identity.recordingId,
      identity.checksumSha256, identity.completedAt,
    ]);
  });

  it("rejects conflicting or aborted media transitions without falsely publishing", async () => {
    const f = fixture(0);
    await expect(f.repository.markReady(identity))
      .rejects.toThrow("talks.replay.media_ready_conflict");
    expect(f.query).toHaveBeenCalledTimes(1);
  });
  it("sets aborted state atomically and preserves the first abort timestamp on retries",async()=>{
    const f=fixture(1);
    const abortInput={
      tenantId:identity.tenantId,talkId:identity.talkId,
      recordingId:identity.recordingId,completedAt:"2026-10-07T10:01:00Z",
    };
    await f.repository.markAborted(abortInput);
    const [sql,params]=f.query.mock.calls[0]!;
    expect(sql).toContain("SET status='aborted'");
    expect(sql).toContain("CASE WHEN status='aborted' THEN completed_at ELSE $4::timestamptz END");
    expect(sql).toContain("WHERE tenant_id=$1 AND talk_id=$2 AND recording_id=$3");
    expect(params).toEqual([
      abortInput.tenantId,abortInput.talkId,abortInput.recordingId,abortInput.completedAt,
    ]);
    await f.repository.markAborted({...abortInput,completedAt:"2026-10-07T11:00:00Z"});
    // Database applies CASE using the row's prior status; once aborted, a
    // later request cannot rewrite the earlier durable completed_at.
    expect(f.query).toHaveBeenCalledTimes(2);
  });

  it("does not report successful revocation when media row is absent",async()=>{
    const f=fixture(0);
    await expect(f.repository.markAborted({
      tenantId:identity.tenantId,talkId:identity.talkId,
      recordingId:identity.recordingId,completedAt:identity.completedAt,
    })).rejects.toThrow("talks.replay.media_not_found");
  });

});
