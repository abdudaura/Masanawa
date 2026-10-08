import { describe, expect, it } from "vitest";
import { openAccountDeletionRequest, transitionAccountDeletion } from "./account-deletion.js";

const timestamp = "2026-10-08T01:00:00.000Z";
const open = () => openAccountDeletionRequest({
  requestId: "req-1", tenantId: "tenant-1", userId: "user-1", now: timestamp,
});
describe("account deletion lifecycle", () => {
  it("opens as a request, not as completed deletion", () => {
    expect(open()).toMatchObject({ phase: "requested", revision: 1 });
  });
  it("requires fresh reauthentication before processing", () => {
    expect(() => transitionAccountDeletion(open(), {
      target: "identity-verified", expectedRevision: 1, now: timestamp,
    })).toThrow("account_deletion.reauthentication_required");
    expect(() => transitionAccountDeletion(open(), {
      target: "processing", expectedRevision: 1, now: timestamp,
    })).toThrow("account_deletion.invalid_transition");
  });
  it("prevents completion without cleanup and settlement", () => {
    const verified = transitionAccountDeletion(open(), {
      target: "identity-verified", identityReauthenticated: true, expectedRevision: 1, now: timestamp,
    });
    const waiting = transitionAccountDeletion(verified, {
      target: "awaiting-settlement", expectedRevision: 2, now: timestamp,
      outstandingObligations: ["pending payout"],
    });
    expect(() => transitionAccountDeletion(waiting, {
      target: "processing", expectedRevision: 3, now: timestamp,
    })).toThrow("account_deletion.outstanding_obligations");
    const processing = transitionAccountDeletion(waiting, {
      target: "processing", expectedRevision: 3, now: timestamp,
      outstandingObligations: [],
    });
    expect(() => transitionAccountDeletion(processing, {
      target: "completed", expectedRevision: 4, now: timestamp,
    })).toThrow("account_deletion.cleanup_incomplete");
    expect(transitionAccountDeletion(processing, {
      target: "completed", expectedRevision: 4, now: timestamp, cleanupComplete: true,
    }).phase).toBe("completed");
  });
  it("rejects stale writes and completed request mutation", () => {
    expect(() => transitionAccountDeletion(open(), {
      target: "failed", expectedRevision: 8, now: timestamp, errorCode: "processor",
    })).toThrow("account_deletion.conflict");
  });
});
