import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  compileCommitmentFollowUpTrigger,
  createProactiveCommitment,
  resolveProactiveCommitment,
  reviseProactiveCommitment,
} from "./commitment.js";

const scope = {
  tenantId: createCanonicalId("tenant"),
  userId: createCanonicalId("user"),
  characterId: createCanonicalId("character"),
  relationshipId: createCanonicalId("relationship"),
};

describe("Proactive commitments", () => {
  it("creates a Character promise with explicit time due", () => {
    const commitment = createProactiveCommitment({
      scope,
      commitmentKey: "send.report",
      kind: "promise",
      responsibleParty: "character",
      statement: "Send the user the report tomorrow morning.",
      due: {
        kind: "time",
        at: toInstant("2026-10-07T08:00:00.000Z"),
        timezone: "Africa/Lagos",
      },
      createdAt: toInstant("2026-10-06T18:00:00.000Z"),
    });

    expect(commitment).toMatchObject({
      scope,
      commitmentKey: "send.report",
      kind: "promise",
      responsibleParty: "character",
      state: "open",
      revision: 1,
      due: {
        kind: "time",
        timezone: "Africa/Lagos",
      },
    });
  });

  it("compiles a time commitment into a one-shot Task-113 follow-up trigger", () => {
    const commitment = createProactiveCommitment({
      scope,
      commitmentKey: "send.report",
      kind: "promise",
      responsibleParty: "character",
      statement: "Send the report.",
      due: {
        kind: "time",
        at: toInstant("2026-10-07T08:00:00.000Z"),
        timezone: "Africa/Lagos",
      },
      createdAt: toInstant("2026-10-06T18:00:00.000Z"),
    });

    const trigger = compileCommitmentFollowUpTrigger({
      commitment,
      compiledAt: toInstant("2026-10-06T18:00:01.000Z"),
    });

    expect(trigger).toMatchObject({
      triggerKey: "followup.send.report",
      state: "active",
      scope,
      definition: {
        kind: "schedule",
        timezone: "Africa/Lagos",
        schedule: {
          kind: "once",
          at: "2026-10-07T08:00:00.000Z",
        },
      },
    });
  });

  it("compiles an event due commitment without adding execution authority", () => {
    const commitment = createProactiveCommitment({
      scope,
      commitmentKey: "follow.payment",
      kind: "commitment",
      responsibleParty: "character",
      statement: "Follow up after payment completes.",
      due: {
        kind: "event",
        eventType: "payment.completed",
        sourceScope: "user",
        filters: {
          currency: "NGN",
        },
      },
      createdAt: toInstant("2026-10-06T18:00:00.000Z"),
    });

    const trigger = compileCommitmentFollowUpTrigger({
      commitment,
      compiledAt: toInstant("2026-10-06T18:00:01.000Z"),
    });

    expect(trigger).toMatchObject({
      triggerKey: "followup.follow.payment",
      definition: {
        kind: "event",
        eventType: "payment.completed",
        sourceScope: "user",
        filters: { currency: "NGN" },
      },
    });
    const json = JSON.stringify(trigger);
    expect(json).not.toContain("toolId");
    expect(json).not.toContain("providerId");
    expect(json).not.toContain("credential");
  });

  it("does not compile automatic follow-up for manual commitments", () => {
    const commitment = createProactiveCommitment({
      scope,
      commitmentKey: "manual.review",
      kind: "commitment",
      responsibleParty: "user",
      statement: "Review the draft when convenient.",
      due: { kind: "manual" },
      createdAt: toInstant("2026-10-06T18:00:00.000Z"),
    });

    expect(
      compileCommitmentFollowUpTrigger({
        commitment,
        compiledAt: toInstant("2026-10-06T18:00:01.000Z"),
      }),
    ).toBeNull();
  });

  it("revises only open commitments with exact revision custody", () => {
    const commitment = createProactiveCommitment({
      scope,
      commitmentKey: "check.back",
      kind: "commitment",
      responsibleParty: "character",
      statement: "Check back tomorrow.",
      due: {
        kind: "time",
        at: toInstant("2026-10-07T12:00:00.000Z"),
        timezone: "Africa/Lagos",
      },
      createdAt: toInstant("2026-10-06T18:00:00.000Z"),
    });

    const revised = reviseProactiveCommitment({
      commitment,
      expectedRevision: 1,
      statement: "Check back tomorrow afternoon.",
      due: {
        kind: "time",
        at: toInstant("2026-10-07T14:00:00.000Z"),
        timezone: "Africa/Lagos",
      },
      changedAt: toInstant("2026-10-06T18:05:00.000Z"),
    });

    expect(revised).toMatchObject({
      revision: 2,
      statement: "Check back tomorrow afternoon.",
      due: { at: "2026-10-07T14:00:00.000Z" },
    });

    expect(() =>
      reviseProactiveCommitment({
        commitment: revised,
        expectedRevision: 1,
        statement: "stale",
        changedAt: toInstant("2026-10-06T18:06:00.000Z"),
      }),
    ).toThrow(/revision is stale/);
  });

  it("fulfills with exact replay and makes resolution terminal", () => {
    const commitment = createProactiveCommitment({
      scope,
      commitmentKey: "deliver.file",
      kind: "promise",
      responsibleParty: "character",
      statement: "Deliver the file.",
      due: { kind: "manual" },
      createdAt: toInstant("2026-10-06T18:00:00.000Z"),
    });

    const fulfilled = resolveProactiveCommitment({
      commitment,
      expectedRevision: 1,
      resolution: "fulfilled",
      resolvedAt: toInstant("2026-10-06T18:10:00.000Z"),
      note: "Delivered in chat.",
    });
    expect(fulfilled).toMatchObject({
      state: "fulfilled",
      revision: 2,
      resolutionNote: "Delivered in chat.",
    });

    const replay = resolveProactiveCommitment({
      commitment: fulfilled,
      expectedRevision: 2,
      resolution: "fulfilled",
      resolvedAt: toInstant("2026-10-06T18:10:00.000Z"),
      note: "Delivered in chat.",
    });
    expect(replay).toBe(fulfilled);

    expect(() =>
      resolveProactiveCommitment({
        commitment: fulfilled,
        expectedRevision: 2,
        resolution: "cancelled",
        resolvedAt: toInstant("2026-10-06T18:11:00.000Z"),
      }),
    ).toThrow(/terminal/);

    expect(() =>
      resolveProactiveCommitment({
        commitment: fulfilled,
        expectedRevision: 2,
        resolution: "fulfilled",
        resolvedAt: toInstant("2026-10-06T18:12:00.000Z"),
        note: "Different evidence.",
      }),
    ).toThrow(/does not match durable resolution evidence/);
  });

  it("stops compiling follow-up after fulfillment or cancellation", () => {
    const commitment = createProactiveCommitment({
      scope,
      commitmentKey: "done.followup",
      kind: "promise",
      responsibleParty: "character",
      statement: "Follow up later.",
      due: {
        kind: "time",
        at: toInstant("2026-10-07T08:00:00.000Z"),
        timezone: "Africa/Lagos",
      },
      createdAt: toInstant("2026-10-06T18:00:00.000Z"),
    });
    const fulfilled = resolveProactiveCommitment({
      commitment,
      expectedRevision: 1,
      resolution: "fulfilled",
      resolvedAt: toInstant("2026-10-06T18:10:00.000Z"),
    });

    expect(
      compileCommitmentFollowUpTrigger({
        commitment: fulfilled,
        compiledAt: toInstant("2026-10-06T18:11:00.000Z"),
      }),
    ).toBeNull();
  });

  it("rejects time commitments due before they were created", () => {
    expect(() =>
      createProactiveCommitment({
        scope,
        commitmentKey: "bad.due",
        kind: "commitment",
        responsibleParty: "character",
        statement: "Impossible due time.",
        due: {
          kind: "time",
          at: toInstant("2026-10-06T17:00:00.000Z"),
          timezone: "Africa/Lagos",
        },
        createdAt: toInstant("2026-10-06T18:00:00.000Z"),
      }),
    ).toThrow(/due before creation/);
  });
});
