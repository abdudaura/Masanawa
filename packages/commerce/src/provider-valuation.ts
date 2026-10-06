export type ProviderValuationEventType =
  | "external-funding"
  | "commerce-purchase";

export interface ProviderValuationPolicy {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly enabled: boolean;
  readonly valuationKey: string;
  readonly eventType: ProviderValuationEventType;
  readonly sourceUnit: string;
  readonly sourceUnitsPerStep: number;
  readonly creditUnitsPerStep: number;
  readonly minimumSourceUnits: number;
  readonly maximumBaseCredits: number | null;
  readonly effectiveAt: string;
}

export interface ProviderValuationDecision {
  readonly eligible: boolean;
  readonly reason:
    | "eligible"
    | "disabled"
    | "event-mismatch"
    | "valuation-key-mismatch"
    | "zero-source"
    | "below-minimum";
  readonly policyRevision: number;
  readonly valuationKey: string;
  readonly sourceUnit: string;
  readonly sourceUnits: number;
  readonly baseCredits: number;
}

function integer(value: number, name: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function token(value: string, name: string, max: number): string {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > max ||
    !/^[A-Za-z0-9][A-Za-z0-9:._-]*$/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function timestamp(value: string, name: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new TypeError(`${name} is invalid`);
  }
  return parsed.toISOString();
}

export function normalizeProviderValuationPolicy(
  input: ProviderValuationPolicy,
): ProviderValuationPolicy {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported provider valuation policy");
  }
  if (
    input.eventType !== "external-funding" &&
    input.eventType !== "commerce-purchase"
  ) {
    throw new TypeError("eventType is invalid");
  }
  const minimumSourceUnits = integer(
    input.minimumSourceUnits,
    "minimumSourceUnits",
    0,
    1_000_000_000_000,
  );
  const maximumBaseCredits =
    input.maximumBaseCredits === null
      ? null
      : integer(
          input.maximumBaseCredits,
          "maximumBaseCredits",
          0,
          1_000_000_000_000,
        );
  return Object.freeze({
    schemaVersion: 1,
    revision: integer(input.revision, "revision", 1, 2_147_483_647),
    enabled: input.enabled === true,
    valuationKey: token(input.valuationKey, "valuationKey", 128),
    eventType: input.eventType,
    sourceUnit: token(input.sourceUnit, "sourceUnit", 64),
    sourceUnitsPerStep: integer(
      input.sourceUnitsPerStep,
      "sourceUnitsPerStep",
      1,
      1_000_000_000_000,
    ),
    creditUnitsPerStep: integer(
      input.creditUnitsPerStep,
      "creditUnitsPerStep",
      1,
      1_000_000_000_000,
    ),
    minimumSourceUnits,
    maximumBaseCredits,
    effectiveAt: timestamp(input.effectiveAt, "effectiveAt"),
  });
}

export function valueProviderAmount(input: {
  readonly policy: ProviderValuationPolicy;
  readonly valuationKey: string;
  readonly eventType: ProviderValuationEventType;
  readonly sourceUnits: number;
}): ProviderValuationDecision {
  const policy = normalizeProviderValuationPolicy(input.policy);
  const valuationKey = token(input.valuationKey, "valuationKey", 128);
  const sourceUnits = integer(
    input.sourceUnits,
    "sourceUnits",
    0,
    1_000_000_000_000,
  );

  const result = (
    eligible: boolean,
    reason: ProviderValuationDecision["reason"],
    baseCredits: number,
  ): ProviderValuationDecision =>
    Object.freeze({
      eligible,
      reason,
      policyRevision: policy.revision,
      valuationKey,
      sourceUnit: policy.sourceUnit,
      sourceUnits,
      baseCredits,
    });

  if (!policy.enabled) return result(false, "disabled", 0);
  if (policy.valuationKey !== valuationKey) {
    return result(false, "valuation-key-mismatch", 0);
  }
  if (policy.eventType !== input.eventType) {
    return result(false, "event-mismatch", 0);
  }
  if (sourceUnits === 0) return result(false, "zero-source", 0);
  if (sourceUnits < policy.minimumSourceUnits) {
    return result(false, "below-minimum", 0);
  }

  const raw =
    (BigInt(sourceUnits) * BigInt(policy.creditUnitsPerStep)) /
    BigInt(policy.sourceUnitsPerStep);
  const capped =
    policy.maximumBaseCredits === null
      ? raw
      : raw > BigInt(policy.maximumBaseCredits)
        ? BigInt(policy.maximumBaseCredits)
        : raw;
  if (capped > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("provider valuation exceeds safe Credit range");
  }
  const baseCredits = Number(capped);
  return result(baseCredits > 0, baseCredits > 0 ? "eligible" : "zero-source", baseCredits);
}
