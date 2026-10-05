export const twinEndpointRetirementDenialReasons = [
  "INVALID_POLICY",
  "REPLACEMENT_NOT_READY",
  "SUPPORTED_CLIENTS_MAY_LACK_REPLACEMENT",
  "COMPATIBILITY_WINDOW_ACTIVE",
  "COMPATIBILITY_EVIDENCE_MISSING",
  "COMPATIBILITY_EVIDENCE_STALE",
  "INSUFFICIENT_EVIDENCE_SAMPLE",
  "UNSUPPORTED_CLIENT_SHARE_TOO_HIGH",
  "ROLLBACK_UNAVAILABLE",
] as const;

export type TwinEndpointRetirementDenialReason =
  (typeof twinEndpointRetirementDenialReasons)[number];

export interface TwinEndpointCompatibilityEvidence {
  readonly observedAt: string;
  readonly observedRequests: number;
  readonly unsupportedClientShareBps: number;
}

export interface TwinEndpointRetirementPolicy {
  readonly legacyEndpointId: string;
  readonly replacementEndpointId: string;
  readonly replacementReady: boolean;
  readonly replacementMinimumClientBuild: number;
  readonly minimumSupportedClientBuild: number;
  readonly compatibilityWindowEndsAt: string;
  readonly maximumEvidenceAgeSeconds: number;
  readonly minimumEvidenceSampleSize: number;
  readonly maximumUnsupportedClientShareBps: number;
  readonly rollbackAvailable: boolean;
}

export interface TwinEndpointRetirementDecision {
  readonly approved: boolean;
  readonly legacyEndpointId: string;
  readonly replacementEndpointId: string;
  readonly reasons: readonly TwinEndpointRetirementDenialReason[];
}

/**
 * Determines whether an obsolete endpoint is eligible for retirement.
 *
 * Approval is deliberately conservative: the replacement must already be ready,
 * every still-supported client build must be capable of using it, the compatibility
 * window must have elapsed, recent fleet evidence must be sufficiently sampled and
 * within the configured unsupported-client ceiling, and a rollback route must exist.
 *
 * This function never removes a route. It is a pure precondition for the single-owner
 * integration/deployment lane that may later perform a retirement.
 */
export function evaluateTwinEndpointRetirement(input: {
  readonly policy: TwinEndpointRetirementPolicy;
  readonly evidence: TwinEndpointCompatibilityEvidence | null;
  readonly now: string;
}): TwinEndpointRetirementDecision {
  const { policy, evidence } = input;
  const reasons: TwinEndpointRetirementDenialReason[] = [];

  const nowMs = Date.parse(input.now);
  const windowEndsMs = Date.parse(policy.compatibilityWindowEndsAt);
  const observedAtMs = evidence ? Date.parse(evidence.observedAt) : Number.NaN;

  const policyValid =
    nonEmpty(policy.legacyEndpointId) &&
    nonEmpty(policy.replacementEndpointId) &&
    policy.legacyEndpointId !== policy.replacementEndpointId &&
    Number.isInteger(policy.replacementMinimumClientBuild) &&
    policy.replacementMinimumClientBuild >= 0 &&
    Number.isInteger(policy.minimumSupportedClientBuild) &&
    policy.minimumSupportedClientBuild >= 0 &&
    Number.isFinite(windowEndsMs) &&
    Number.isFinite(nowMs) &&
    Number.isInteger(policy.maximumEvidenceAgeSeconds) &&
    policy.maximumEvidenceAgeSeconds > 0 &&
    Number.isInteger(policy.minimumEvidenceSampleSize) &&
    policy.minimumEvidenceSampleSize > 0 &&
    isBasisPoints(policy.maximumUnsupportedClientShareBps);

  if (!policyValid) {
    reasons.push("INVALID_POLICY");
  }

  if (!policy.replacementReady) {
    reasons.push("REPLACEMENT_NOT_READY");
  }

  if (
    Number.isInteger(policy.minimumSupportedClientBuild) &&
    Number.isInteger(policy.replacementMinimumClientBuild) &&
    policy.minimumSupportedClientBuild < policy.replacementMinimumClientBuild
  ) {
    reasons.push("SUPPORTED_CLIENTS_MAY_LACK_REPLACEMENT");
  }

  if (
    Number.isFinite(nowMs) &&
    Number.isFinite(windowEndsMs) &&
    nowMs < windowEndsMs
  ) {
    reasons.push("COMPATIBILITY_WINDOW_ACTIVE");
  }

  if (evidence === null) {
    reasons.push("COMPATIBILITY_EVIDENCE_MISSING");
  } else {
    const evidenceShapeValid =
      Number.isFinite(observedAtMs) &&
      Number.isInteger(evidence.observedRequests) &&
      evidence.observedRequests >= 0 &&
      isBasisPoints(evidence.unsupportedClientShareBps);

    if (!evidenceShapeValid) {
      if (!reasons.includes("INVALID_POLICY")) {
        reasons.push("INVALID_POLICY");
      }
    } else {
      const ageMs = nowMs - observedAtMs;
      const maximumAgeMs = policy.maximumEvidenceAgeSeconds * 1_000;
      if (
        !Number.isFinite(nowMs) ||
        ageMs < 0 ||
        !Number.isFinite(maximumAgeMs) ||
        ageMs > maximumAgeMs
      ) {
        reasons.push("COMPATIBILITY_EVIDENCE_STALE");
      }

      if (evidence.observedRequests < policy.minimumEvidenceSampleSize) {
        reasons.push("INSUFFICIENT_EVIDENCE_SAMPLE");
      }

      if (
        evidence.unsupportedClientShareBps >
        policy.maximumUnsupportedClientShareBps
      ) {
        reasons.push("UNSUPPORTED_CLIENT_SHARE_TOO_HIGH");
      }
    }
  }

  if (!policy.rollbackAvailable) {
    reasons.push("ROLLBACK_UNAVAILABLE");
  }

  return Object.freeze({
    approved: reasons.length === 0,
    legacyEndpointId: policy.legacyEndpointId,
    replacementEndpointId: policy.replacementEndpointId,
    reasons: Object.freeze(reasons),
  });
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function isBasisPoints(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 10_000;
}
