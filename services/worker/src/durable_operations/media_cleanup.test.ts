import { describe, expect, it, vi } from "vitest";
import {
  runMediaCleanupBatch, validCleanupCandidate,
  type CleanupCandidate, type CleanupPreflight, type MediaCleanupRepository,
  type ImmutableObjectDeleter,
} from "./media_cleanup.js";

const checksum = "a".repeat(64);
const valid: CleanupCandidate = {
  tenantId: "tenant_123456789012",
  kind: "avatar",
  objectKey: `profiles/tenant_123456789012/user_123456789012/sha256-${checksum}.webp`,
  objectVersion: null,
  leaseToken: "claimed_token_123456789",
  referenceRevision: 7,
};
const ready: CleanupPreflight = { state: "ready", referenceRevision: 7, activeReferences: 0, activeHolds: 0, immutable: true };

function rig(candidates: CleanupCandidate[] = [valid]) {
  const repository: MediaCleanupRepository = {
    claim: vi.fn(async () => candidates),
    preflight: vi.fn(async () => ready),
    complete: vi.fn(async () => true),
    stop: vi.fn(async () => undefined),
  };
  const storage: ImmutableObjectDeleter = {
    deleteExact: vi.fn(async () => "deleted" as const),
  };
  const run = () => runMediaCleanupBatch({
    workerId: "worker_instance_12345678", max: 10, nowMs: Date.now(),
    repository, storage,
  });
  return { repository, storage, run };
}

describe("AF15 durable media deletion boundary", () => {
  it("accepts only tenant-fenced immutable candidates", () => {
    expect(validCleanupCandidate(valid)).toBe(true);
    expect(validCleanupCandidate({ ...valid, tenantId: "tenant_foreign999999" })).toBe(false);
    expect(validCleanupCandidate({ ...valid, objectKey: "https://example.org/foo" })).toBe(false);
    expect(validCleanupCandidate({ ...valid, objectKey: "profiles/tenant_123456789012/../bad" })).toBe(false);
    expect(validCleanupCandidate({ ...valid, objectKey: "profiles/tenant_123456789012/mutable.jpg" })).toBe(false);
    expect(validCleanupCandidate({ ...valid, objectKey: "profiles/tenant_123456789012/a*" })).toBe(false);
    expect(validCleanupCandidate({ ...valid, objectVersion: "version-1" })).toBe(true);
  });

  it("runs a single tombstoned object and commits only after delete", async () => {
    const { storage, repository, run } = rig();
    expect(await run()).toMatchObject({ claimed: 1, deleted: 1, absent: 0 });
    expect(storage.deleteExact).toHaveBeenCalledOnce();
    expect(repository.complete).toHaveBeenCalledWith(valid);
    expect(repository.stop).not.toHaveBeenCalled();
  });

  it("treats known missing objects as idempotent cleanup", async () => {
    const r = rig();
    vi.mocked(r.storage.deleteExact).mockResolvedValue("absent");
    expect(await r.run()).toMatchObject({ absent: 1, deleted: 0 });
  });

  it("does not delete held, referenced, forged or mismatched revision objects", async () => {
    for (const state of [
      { state: "blocked" } as const,
      { ...ready, activeHolds: 1 } as unknown as CleanupPreflight,
      { ...ready, activeReferences: 1 } as unknown as CleanupPreflight,
      { ...ready, referenceRevision: 8 },
      { ...ready, immutable: false } as unknown as CleanupPreflight,
    ]) {
      const r = rig();
      vi.mocked(r.repository.preflight).mockResolvedValue(state);
      const result = await r.run();
      expect(result.deleted).toBe(0);
      expect(r.storage.deleteExact).not.toHaveBeenCalled();
      expect(r.repository.stop).toHaveBeenCalledOnce();
    }
  });

  it("does not delete after lease loss", async () => {
    const r = rig();
    vi.mocked(r.repository.preflight).mockResolvedValue({ state: "lease-lost" });
    expect(await r.run()).toMatchObject({ leaseLost: 1 });
    expect(r.storage.deleteExact).not.toHaveBeenCalled();
    expect(r.repository.stop).not.toHaveBeenCalled();
  });

  it("quarantines provider uncertainty without automatic retries", async () => {
    const r = rig();
    vi.mocked(r.storage.deleteExact).mockRejectedValue(new Error("timeout after commit"));
    expect(await r.run()).toMatchObject({ quarantined: 1, deleted: 0 });
    expect(r.storage.deleteExact).toHaveBeenCalledTimes(1);
    expect(r.repository.complete).not.toHaveBeenCalled();
    expect(r.repository.stop).toHaveBeenCalledWith(valid, "uncertain");
  });

  it("quarantines success when durable completion fails", async () => {
    const r = rig();
    vi.mocked(r.repository.complete).mockRejectedValue(new Error("DB unavailable"));
    expect(await r.run()).toMatchObject({ quarantined: 1, deleted: 0 });
    expect(r.repository.stop).toHaveBeenCalledWith(valid, "completed-but-unrecorded");
  });

  it("honors lease fence failure without falsely confirming deletion", async () => {
    const r = rig();
    vi.mocked(r.repository.complete).mockResolvedValue(false);
    expect(await r.run()).toMatchObject({ deleted: 0, leaseLost: 1 });
  });

  it("rejects invalid job options and oversized claimed batches", async () => {
    const r = rig();
    await expect(runMediaCleanupBatch({ workerId: "bad", nowMs: 0, max: 10, repository: r.repository, storage: r.storage })).rejects.toThrow(/invalid_batch/);
    vi.mocked(r.repository.claim).mockResolvedValue(Array(11).fill(valid));
    await expect(r.run()).rejects.toThrow(/invalid_claim_response/);
    expect(r.storage.deleteExact).not.toHaveBeenCalled();
  });

  it("stops on drain without claiming or starting subsequent deletes", async () => {
    const r = rig([valid]);
    expect(await runMediaCleanupBatch({ workerId: "worker_instance_12345678", nowMs: 0, max: 2, repository: r.repository, storage: r.storage, shouldStop: () => true })).toMatchObject({ claimed: 0 });
    expect(r.repository.claim).not.toHaveBeenCalled();
  });

  it("does not delete a duplicate claimed object twice", async () => {
    const r = rig([valid, { ...valid, leaseToken: "another_token_12345678" }]);
    expect(await r.run()).toMatchObject({ claimed: 2, deleted: 1, quarantined: 1 });
    expect(r.storage.deleteExact).toHaveBeenCalledOnce();
  });
});
