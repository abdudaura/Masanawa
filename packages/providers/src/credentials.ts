import {
  isCanonicalId,
  type CredentialRefId,
  type OperationId,
  type ProviderId,
  type TenantId,
} from "@masanawa/contracts";
import type { ProviderDefinition } from "./model.js";

export type ProviderCredentialBindings = Readonly<
  Record<string, CredentialRefId>
>;

export function normalizeProviderCredentialBindings(
  provider: ProviderDefinition,
  input: Readonly<Record<string, CredentialRefId>>,
): ProviderCredentialBindings {
  if (input === null || Array.isArray(input) || typeof input !== "object") {
    throw new TypeError("provider credential bindings must be an object");
  }

  const slots = new Map(provider.credentialSlots.map((slot) => [slot.key, slot]));
  const entries = Object.entries(input).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const normalized: Record<string, CredentialRefId> = {};

  for (const [rawKey, credentialRefId] of entries) {
    const key = rawKey.trim().toLowerCase();
    if (!slots.has(key)) {
      throw new TypeError(
        `credential binding references unknown provider slot: ${rawKey}`,
      );
    }
    if (!isCanonicalId("credential-ref", credentialRefId)) {
      throw new TypeError(
        `credential binding for ${key} must be a canonical CredentialRefId`,
      );
    }
    if (Object.hasOwn(normalized, key)) {
      throw new TypeError(`duplicate provider credential binding: ${key}`);
    }
    normalized[key] = credentialRefId;
  }

  for (const slot of provider.credentialSlots) {
    if (slot.required && !Object.hasOwn(normalized, slot.key)) {
      throw new TypeError(
        `required provider credential slot is not bound: ${slot.key}`,
      );
    }
  }

  return Object.freeze(normalized);
}


export interface ProviderCredentialAccessRequest {
  readonly tenantId: TenantId;
  readonly operationId: OperationId;
  readonly providerId: ProviderId;
  readonly providerKey: string;
  readonly providerVersion: string;
  readonly purpose: string;
  readonly destinationOrigin: string;
  readonly bindings: ProviderCredentialBindings;
}

export class EphemeralProviderSecret {
  readonly #value: string;

  constructor(value: string) {
    if (typeof value !== "string" || value.length < 1) {
      throw new TypeError("provider secret value is required");
    }
    this.#value = value;
    Object.freeze(this);
  }

  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return "[REDACTED]";
  }

  toJSON(): string {
    return "[REDACTED]";
  }
}

export type ResolvedProviderCredentials = Readonly<
  Record<string, EphemeralProviderSecret>
>;

export interface ProviderCredentialLease {
  readonly credentials: ResolvedProviderCredentials;
  release(): void | Promise<void>;
}

export interface ProviderCredentialResolver {
  acquire(
    request: ProviderCredentialAccessRequest,
  ): Promise<ProviderCredentialLease>;
}

const credentialPurposePattern =
  /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/u;

function normalizeCredentialPurpose(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 1 ||
    normalized.length > 200 ||
    !credentialPurposePattern.test(normalized)
  ) {
    throw new TypeError("provider credential purpose is invalid");
  }
  return normalized;
}

function normalizeDestinationOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("provider credential destinationOrigin is invalid");
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new TypeError(
      "provider credential destinationOrigin must be a bare HTTP(S) origin",
    );
  }
  return url.origin;
}

export function normalizeProviderCredentialAccessRequest(
  provider: ProviderDefinition,
  input: ProviderCredentialAccessRequest,
): ProviderCredentialAccessRequest {
  if (input.providerId !== provider.providerId) {
    throw new TypeError("credential access providerId does not match Provider");
  }
  if (input.providerKey.trim().toLowerCase() !== provider.key) {
    throw new TypeError("credential access providerKey does not match Provider");
  }
  if (input.providerVersion.trim() !== provider.version) {
    throw new TypeError(
      "credential access providerVersion does not match Provider",
    );
  }
  if (!isCanonicalId("tenant", input.tenantId)) {
    throw new TypeError("credential access tenantId is invalid");
  }
  if (!isCanonicalId("operation", input.operationId)) {
    throw new TypeError("credential access operationId is invalid");
  }

  return Object.freeze({
    tenantId: input.tenantId,
    operationId: input.operationId,
    providerId: input.providerId,
    providerKey: provider.key,
    providerVersion: provider.version,
    purpose: normalizeCredentialPurpose(input.purpose),
    destinationOrigin: normalizeDestinationOrigin(input.destinationOrigin),
    bindings: normalizeProviderCredentialBindings(provider, input.bindings),
  });
}

export async function withResolvedProviderCredentials<T>(
  resolver: ProviderCredentialResolver,
  request: ProviderCredentialAccessRequest,
  use: (credentials: ResolvedProviderCredentials) => T | Promise<T>,
): Promise<T> {
  const lease = await resolver.acquire(request);
  try {
    return await use(lease.credentials);
  } finally {
    await lease.release();
  }
}
