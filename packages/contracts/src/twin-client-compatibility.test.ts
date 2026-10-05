import { describe, expect, it } from "vitest";
import {
  evaluateTwinEndpointRetirement,
  type TwinEndpointCompatibilityEvidence,
  type TwinEndpointRetirementPolicy,
} from "./twin-client-compatibility.js";

const now = "2026-10-05T10:00:00.000Z";

function policy(
  overrides: Partial<TwinEndpointRetirementPolicy> = {},
): TwinEndpointRetirementPolicy {
  return {
    legacyEndpointId: "legacy.clone.directory",
    replacementEndpointId: "twin.explore.directory",
    replacementReady: true,
    replacementMinimumClientBuild: 420,
    minimumSupportedClientBuild: 420,
    compatibilityWindowEndsAt: "2026-10-04T10:00:00.000Z",
    maximumEvidenceAgeSeconds: 86_400,
    minimumEvidenceSampleSize: 1_000,
    maximumUnsupportedClientShareBps: 25,
    rollbackAvailable: true,
    ...overrides,
  };
}

function evidence(
  overrides: Partial<TwinEndpointCompatibilityEvidence> = {},
): TwinEndpointCompatibilityEvidence {
  return {
    observedAt: "2026-10-05T09:30:00.000Z",
    observedRequests: 10_000,
    unsupportedClientShareBps: 10,
    ...overrides,
  };
}

describe("evaluateTwinEndpointRetirement", () => {
  it("approves only when replacement, fleet evidence, window and rollback gates pass", () => {
    expect(
      evaluateTwinEndpointRetirement({
        policy: policy(),
        evidence: evidence(),
        now,
      }),
    ).toEqual({
      approved: true,
      legacyEndpointId: "legacy.clone.directory",
      replacementEndpointId: "twin.explore.directory",
      reasons: [],
    });
  });

  it("fails closed while the replacement is not ready", () => {
    const decision = evaluateTwinEndpointRetirement({
      policy: policy({ replacementReady: false }),
      evidence: evidence(),
      now,
    });

    expect(decision.approved).toBe(false);
    expect(decision.reasons).toContain("REPLACEMENT_NOT_READY");
  });

  it("fails closed while a still-supported client build may lack the replacement", () => {
    const decision = evaluateTwinEndpointRetirement({
      policy: policy({ minimumSupportedClientBuild: 419 }),
      evidence: evidence(),
      now,
    });

    expect(decision.approved).toBe(false);
    expect(decision.reasons).toContain(
      "SUPPORTED_CLIENTS_MAY_LACK_REPLACEMENT",
    );
  });

  it("fails closed before the compatibility window expires", () => {
    const decision = evaluateTwinEndpointRetirement({
      policy: policy({ compatibilityWindowEndsAt: "2026-10-06T10:00:00.000Z" }),
      evidence: evidence(),
      now,
    });

    expect(decision.reasons).toContain("COMPATIBILITY_WINDOW_ACTIVE");
  });

  it("requires recent, sufficiently sampled compatibility evidence", () => {
    const missing = evaluateTwinEndpointRetirement({
      policy: policy(),
      evidence: null,
      now,
    });
    expect(missing.reasons).toContain("COMPATIBILITY_EVIDENCE_MISSING");

    const staleAndSmall = evaluateTwinEndpointRetirement({
      policy: policy(),
      evidence: evidence({
        observedAt: "2026-10-03T09:30:00.000Z",
        observedRequests: 999,
      }),
      now,
    });
    expect(staleAndSmall.reasons).toEqual(
      expect.arrayContaining([
        "COMPATIBILITY_EVIDENCE_STALE",
        "INSUFFICIENT_EVIDENCE_SAMPLE",
      ]),
    );
  });

  it("enforces the configured unsupported-client ceiling in basis points", () => {
    const atLimit = evaluateTwinEndpointRetirement({
      policy: policy(),
      evidence: evidence({ unsupportedClientShareBps: 25 }),
      now,
    });
    expect(atLimit.approved).toBe(true);

    const aboveLimit = evaluateTwinEndpointRetirement({
      policy: policy(),
      evidence: evidence({ unsupportedClientShareBps: 26 }),
      now,
    });
    expect(aboveLimit.reasons).toContain(
      "UNSUPPORTED_CLIENT_SHARE_TOO_HIGH",
    );
  });

  it("fails closed without a rollback route", () => {
    const decision = evaluateTwinEndpointRetirement({
      policy: policy({ rollbackAvailable: false }),
      evidence: evidence(),
      now,
    });

    expect(decision.reasons).toContain("ROLLBACK_UNAVAILABLE");
  });

  it("rejects malformed policy or evidence rather than accidentally approving", () => {
    const malformed = evaluateTwinEndpointRetirement({
      policy: policy({
        legacyEndpointId: "",
        maximumUnsupportedClientShareBps: 10_001,
      }),
      evidence: evidence({ unsupportedClientShareBps: -1 }),
      now: "not-a-date",
    });

    expect(malformed.approved).toBe(false);
    expect(malformed.reasons).toContain("INVALID_POLICY");
  });

  it("is deterministic and returns frozen decision data", () => {
    const input = { policy: policy(), evidence: evidence(), now };
    const first = evaluateTwinEndpointRetirement(input);
    const second = evaluateTwinEndpointRetirement(input);

    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.reasons)).toBe(true);
  });
});
