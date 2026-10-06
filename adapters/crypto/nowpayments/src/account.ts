export type NowPaymentsAccountCapability =
  | "custody"
  | "customer_management"
  | "conversion"
  | "payout";

export interface NowPaymentsAccountEvidence {
  readonly custodyEnabled: boolean | null;
  readonly customerManagementEnabled: boolean | null;
  readonly conversionEnabled: boolean | null;
  readonly payoutEnabled: boolean | null;
  readonly ipWhitelistSatisfied: boolean | null;
  readonly payoutDestinationWhitelistSatisfied: boolean | null;
  readonly observedAt: string;
}

export interface AccountCapabilityQualification {
  readonly capability: NowPaymentsAccountCapability;
  readonly eligible: boolean;
  readonly reasons: readonly string[];
}

function capabilityValue(
  evidence: NowPaymentsAccountEvidence,
  capability: NowPaymentsAccountCapability,
): boolean | null {
  switch (capability) {
    case "custody":
      return evidence.custodyEnabled;
    case "customer_management":
      return evidence.customerManagementEnabled;
    case "conversion":
      return evidence.conversionEnabled;
    case "payout":
      return evidence.payoutEnabled;
  }
}

export function qualifyAccountCapability(
  evidence: NowPaymentsAccountEvidence,
  capability: NowPaymentsAccountCapability,
): AccountCapabilityQualification {
  const reasons: string[] = [];
  const available = capabilityValue(evidence, capability);

  if (available !== true) {
    reasons.push(available === false ? "capability.unavailable" : "capability.unverified");
  }

  if (
    (capability === "custody" ||
      capability === "customer_management" ||
      capability === "conversion" ||
      capability === "payout") &&
    evidence.ipWhitelistSatisfied !== true
  ) {
    reasons.push(
      evidence.ipWhitelistSatisfied === false
        ? "security.ip_whitelist.unsatisfied"
        : "security.ip_whitelist.unverified",
    );
  }

  if (capability === "payout" && evidence.payoutDestinationWhitelistSatisfied !== true) {
    reasons.push(
      evidence.payoutDestinationWhitelistSatisfied === false
        ? "security.destination_whitelist.unsatisfied"
        : "security.destination_whitelist.unverified",
    );
  }

  return Object.freeze({
    capability,
    eligible: reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}

export function assertFreshAccountEvidence(
  evidence: NowPaymentsAccountEvidence,
  options: {
    readonly now?: Date;
    readonly maxAgeMs?: number;
  } = {},
): void {
  const observed = Date.parse(evidence.observedAt);
  const now = (options.now ?? new Date()).getTime();
  const maxAgeMs = options.maxAgeMs ?? 5 * 60_000;

  if (!Number.isFinite(observed)) throw new Error("nowpayments.account_evidence.invalid_time");
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    throw new Error("nowpayments.account_evidence.invalid_max_age");
  }
  if (observed > now + 30_000) throw new Error("nowpayments.account_evidence.from_future");
  if (now - observed > maxAgeMs) throw new Error("nowpayments.account_evidence.stale");
}
