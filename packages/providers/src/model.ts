import {
  isCanonicalId,
  normalizeCapabilityKey,
  toInstant,
  type CapabilityKey,
  type Instant,
  type ProviderId,
} from "@masanawa/contracts";

export const providerReadinessStates = [
  "ready",
  "degraded",
  "unavailable",
  "disabled",
] as const;

export type ProviderReadinessState =
  (typeof providerReadinessStates)[number];

export interface ProviderCredentialSlot {
  readonly key: string;
  readonly required: boolean;
  readonly description: string | null;
}

export interface ProviderDefinition {
  readonly providerId: ProviderId;
  readonly key: string;
  readonly version: string;
  readonly displayName: string;
  readonly capabilities: readonly CapabilityKey[];
  readonly selectionPriority: number;
  readonly credentialSlots: readonly ProviderCredentialSlot[];
}

export interface ProviderReadiness {
  readonly providerId: ProviderId;
  readonly state: ProviderReadinessState;
  readonly reasonCode: string | null;
  readonly checkedAt: Instant;
}

function bounded(
  value: string,
  name: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

const providerKeyPattern =
  /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const providerVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

export function normalizeProviderKey(value: string): string {
  const normalized = bounded(value, "provider.key", 128).toLowerCase();
  if (!providerKeyPattern.test(normalized)) {
    throw new TypeError("provider.key is invalid");
  }
  return normalized;
}

export function normalizeProviderVersion(value: string): string {
  const normalized = bounded(value, "provider.version", 128);
  if (!providerVersionPattern.test(normalized)) {
    throw new TypeError("provider.version is invalid");
  }
  return normalized;
}

function normalizeCredentialSlot(
  value: ProviderCredentialSlot,
): ProviderCredentialSlot {
  const key = normalizeProviderKey(value.key);
  return Object.freeze({
    key,
    required: value.required === true,
    description:
      value.description === null
        ? null
        : bounded(value.description, "credentialSlot.description", 500),
  });
}

export function normalizeProviderDefinition(
  input: ProviderDefinition,
): ProviderDefinition {
  if (!isCanonicalId("provider", input.providerId)) {
    throw new TypeError("providerId is invalid");
  }
  if (
    !Number.isSafeInteger(input.selectionPriority) ||
    input.selectionPriority < 0 ||
    input.selectionPriority > 10_000
  ) {
    throw new RangeError(
      "selectionPriority must be an integer between 0 and 10000",
    );
  }
  if (!Array.isArray(input.capabilities) || input.capabilities.length < 1) {
    throw new RangeError("provider must advertise at least one capability");
  }
  if (input.capabilities.length > 256) {
    throw new RangeError("provider advertises too many capabilities");
  }

  const capabilities = input.capabilities.map((value) =>
    normalizeCapabilityKey(value),
  );
  if (new Set(capabilities).size !== capabilities.length) {
    throw new TypeError("provider capabilities must be unique");
  }
  capabilities.sort();

  if (
    !Array.isArray(input.credentialSlots) ||
    input.credentialSlots.length > 64
  ) {
    throw new RangeError("provider credentialSlots are invalid");
  }
  const credentialSlots = input.credentialSlots.map(normalizeCredentialSlot);
  const credentialKeys = credentialSlots.map((slot) => slot.key);
  if (new Set(credentialKeys).size !== credentialKeys.length) {
    throw new TypeError("provider credential slot keys must be unique");
  }
  credentialSlots.sort((left, right) => left.key.localeCompare(right.key));

  return Object.freeze({
    providerId: input.providerId,
    key: normalizeProviderKey(input.key),
    version: normalizeProviderVersion(input.version),
    displayName: bounded(input.displayName, "provider.displayName", 200),
    capabilities: Object.freeze(capabilities),
    selectionPriority: input.selectionPriority,
    credentialSlots: Object.freeze(credentialSlots),
  });
}

const readinessSet = new Set<string>(providerReadinessStates);
const reasonCodePattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

export function normalizeProviderReadiness(
  input: ProviderReadiness,
): ProviderReadiness {
  if (!isCanonicalId("provider", input.providerId)) {
    throw new TypeError("provider readiness providerId is invalid");
  }
  if (!readinessSet.has(input.state)) {
    throw new TypeError("provider readiness state is invalid");
  }

  let reasonCode: string | null = null;
  if (input.reasonCode !== null) {
    reasonCode = bounded(
      input.reasonCode,
      "provider.readiness.reasonCode",
      200,
    ).toLowerCase();
    if (!reasonCodePattern.test(reasonCode)) {
      throw new TypeError("provider readiness reasonCode is invalid");
    }
  }

  return Object.freeze({
    providerId: input.providerId,
    state: input.state,
    reasonCode,
    checkedAt: toInstant(input.checkedAt),
  });
}
