declare const capabilityKeyBrand: unique symbol;

export type CapabilityKey = string & {
  readonly [capabilityKeyBrand]: "CapabilityKey";
};

const capabilityPattern =
  /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

export function normalizeCapabilityKey(value: string): CapabilityKey {
  if (typeof value !== "string") {
    throw new TypeError("Capability key must be a string");
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 1 ||
    normalized.length > 128 ||
    !capabilityPattern.test(normalized)
  ) {
    throw new TypeError("Capability key is invalid");
  }
  return normalized as CapabilityKey;
}

export function isCapabilityKey(value: unknown): value is CapabilityKey {
  if (typeof value !== "string") return false;
  try {
    return normalizeCapabilityKey(value) === value;
  } catch {
    return false;
  }
}
