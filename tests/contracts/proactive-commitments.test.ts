import { describe, expect, it } from "vitest";
import {
  commitmentNeedsFollowUp,
  normalizeCommitment,
  transitionCommitment,
  type ProactiveCommitment,
} from "../../packages/proactivity/src/commitments.js";

const commitment: ProactiveCommitment = {
  schemaVersion: 1,
  commitmentId: "commitment-000001",
  revision: 1,
  scope: {
    tenantId: "tenant_0199f0a0-0000-7000-8000-000000000501",
    userId: "user_0199f0a0-0000-7000-8000-000000000502",
    relationshipId:
      "relationship_0199f0a0-0000-7000-8000-000000000503",
    characterId:
      "character_0199f0a0-0000-7000-8000-000000000504",
  },
  promise: "Send the requested summary tomorrow morning.",
  createdAt: "2026-10-06T09:00:00Z",
  dueAt: "2026-10-07T08:00:00Z",
  followUpTriggerId: "trigger-follow-up-0001",
  state: "open",
  completedAt: null,
  cancelledAt: null,
  expiredAt: null,
};

describe("proactive commitments", () => {
  it("normalizes an open commitment with explicit follow-up trigger linkage", () => {
    expect(normalizeCommitment(commitment)).toMatchObject({
      state: "open",
      followUpTriggerId: "trigger-follow-up-0001",
      dueAt: "2026-10-07T08:00:00.000Z",
    });
  });

  it("rejects commitments without a real future due time", () => {
    expect(() =>
      normalizeCommitment({
        ...commitment,
        dueAt: commitment.createdAt,
      }),
    ).toThrow("dueAt must be after createdAt");
  });

  it("marks open commitments due for follow-up only once due time is reached", () => {
    expect(
      commitmentNeedsFollowUp(commitment, "2026-10-07T07:59:59Z"),
    ).toBe(false);
    expect(
      commitmentNeedsFollowUp(commitment, "2026-10-07T08:00:00Z"),
    ).toBe(true);
  });

  it("transitions completion with immutable revision advancement", () => {
    const completed = transitionCommitment({
      current: commitment,
      nextState: "completed",
      occurredAt: "2026-10-07T07:30:00Z",
    });
    expect(completed).toMatchObject({
      revision: 2,
      state: "completed",
      completedAt: "2026-10-07T07:30:00.000Z",
      cancelledAt: null,
      expiredAt: null,
    });
    expect(commitment.state).toBe("open");
    expect(commitmentNeedsFollowUp(completed, "2026-10-08T00:00:00Z")).toBe(
      false,
    );
  });

  it("does not allow expiry before the due time", () => {
    expect(() =>
      transitionCommitment({
        current: commitment,
        nextState: "expired",
        occurredAt: "2026-10-07T07:59:59Z",
      }),
    ).toThrow("cannot expire before dueAt");
  });

  it("prevents a terminal commitment from transitioning again", () => {
    const cancelled = transitionCommitment({
      current: commitment,
      nextState: "cancelled",
      occurredAt: "2026-10-06T10:00:00Z",
    });
    expect(() =>
      transitionCommitment({
        current: cancelled,
        nextState: "completed",
        occurredAt: "2026-10-06T11:00:00Z",
      }),
    ).toThrow("terminal commitment cannot transition again");
  });

  it("rejects contradictory terminal timestamps", () => {
    expect(() =>
      normalizeCommitment({
        ...commitment,
        state: "completed",
        completedAt: "2026-10-07T07:00:00Z",
        cancelledAt: "2026-10-07T07:10:00Z",
      }),
    ).toThrow("requires only completedAt");
  });

  it("requires a non-empty explicit follow-up trigger identity", () => {
    expect(() =>
      normalizeCommitment({
        ...commitment,
        followUpTriggerId: " ",
      }),
    ).toThrow("followUpTriggerId");
  });
});
