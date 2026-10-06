import { describe, expect, it } from "vitest";
import {
  evaluatePerceptionMemoryPromotion,
} from "../../packages/perception/src/memory-promotion.js";
import type { PerceptionEvent } from "../../packages/perception/src/perception-event.js";

const relationshipId =
  "relationship_0199f0a0-0000-7000-8000-000000000701";
const characterId =
  "character_0199f0a0-0000-7000-8000-000000000702";

function event(
  privacy: PerceptionEvent["privacy"] = {
    scope: "relationship",
    retention: "durable",
    memoryPromotion: "review-required",
  },
): PerceptionEvent {
  return {
    schemaVersion: 1,
    perceptionEventId: "event_0199f0a0-0000-7000-8000-000000000703",
    tenantId: "tenant_0199f0a0-0000-7000-8000-000000000704",
    kind: "text",
    source: {
      kind: "app",
      sourceId: "mobile-chat",
      deviceId: null,
      channelAccountId: null,
    },
    subject: {
      userId: "user_0199f0a0-0000-7000-8000-000000000705",
      relationshipId,
      characterId,
    },
    permission: {
      authorityContextId:
        "authority-context_0199f0a0-0000-7000-8000-000000000706",
      basis: "user-action",
      revision: 1,
      purposes: ["conversation", "memory-promotion"],
    },
    privacy,
    payload: {
      mediaType: "text/plain",
      contentRef: null,
      inlineText: "Remember that I prefer concise summaries.",
      attributes: {},
    },
    dedupeKey: "message:memory-candidate:1",
    observedAt: "2026-10-06T10:00:00Z",
    receivedAt: "2026-10-06T10:00:01Z",
  };
}

const review = {
  reviewerUserId: "user_0199f0a0-0000-7000-8000-000000000707",
  authorityContextId:
    "authority-context_0199f0a0-0000-7000-8000-000000000708",
  decision: "approve" as const,
  reviewedAt: "2026-10-06T10:05:00Z",
  reason: "User explicitly requested durable memory.",
};

describe("perception to memory promotion governance", () => {
  it("allows reviewed durable relationship perception only into the same Relationship", () => {
    expect(
      evaluatePerceptionMemoryPromotion({
        event: event(),
        destination: { kind: "relationship", relationshipId },
        review,
      }),
    ).toMatchObject({
      allowed: true,
      reason: "allowed",
      destination: { kind: "relationship", relationshipId },
    });
  });

  it("rejects session/ephemeral perception even with review approval", () => {
    expect(
      evaluatePerceptionMemoryPromotion({
        event: event({
          scope: "relationship",
          retention: "session",
          memoryPromotion: "review-required",
        }),
        destination: { kind: "relationship", relationshipId },
        review,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "source-not-durable",
    });
  });

  it("rejects durable perception when promotion policy is forbidden", () => {
    expect(
      evaluatePerceptionMemoryPromotion({
        event: event({
          scope: "relationship",
          retention: "durable",
          memoryPromotion: "forbidden",
        }),
        destination: { kind: "relationship", relationshipId },
        review,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "promotion-forbidden",
    });
  });

  it("requires explicit memory-promotion purpose evidence", () => {
    const candidate = event();
    expect(
      evaluatePerceptionMemoryPromotion({
        event: {
          ...candidate,
          permission: {
            ...candidate.permission,
            purposes: ["conversation"],
          },
        },
        destination: { kind: "relationship", relationshipId },
        review,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "permission-purpose-missing",
    });
  });

  it("honors an explicit review denial", () => {
    expect(
      evaluatePerceptionMemoryPromotion({
        event: event(),
        destination: { kind: "relationship", relationshipId },
        review: { ...review, decision: "deny" },
      }),
    ).toMatchObject({
      allowed: false,
      reason: "review-denied",
    });
  });

  it("never widens Relationship-scoped perception into Character-private memory or another Relationship", () => {
    expect(
      evaluatePerceptionMemoryPromotion({
        event: event(),
        destination: { kind: "character-private", characterId },
        review,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "destination-widens-privacy",
    });

    expect(
      evaluatePerceptionMemoryPromotion({
        event: event(),
        destination: {
          kind: "relationship",
          relationshipId:
            "relationship_0199f0a0-0000-7000-8000-000000000799",
        },
        review,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "destination-widens-privacy",
    });
  });

  it("allows Character-private perception only into the same Character-private scope", () => {
    expect(
      evaluatePerceptionMemoryPromotion({
        event: event({
          scope: "character-private",
          retention: "durable",
          memoryPromotion: "review-required",
        }),
        destination: { kind: "character-private", characterId },
        review,
      }),
    ).toMatchObject({ allowed: true, reason: "allowed" });
  });

  it("fails closed for user-private perception because no canonical user-private Memory destination exists", () => {
    expect(
      evaluatePerceptionMemoryPromotion({
        event: event({
          scope: "user-private",
          retention: "durable",
          memoryPromotion: "review-required",
        }),
        destination: { kind: "relationship", relationshipId },
        review,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "source-scope-unsupported",
    });
  });
});
