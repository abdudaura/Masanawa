import {
  PlatformError,
  isCanonicalId,
  parseCanonicalId,
  type CredentialRefId,
  type OperationId,
} from "@masanawa/contracts";
import {
  principalKey,
  withCredentialSecret,
  type AuthorityContext,
  type CredentialAccessDependencies,
} from "@masanawa/security";
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


export interface ProviderCredentialUseContext {
  readonly authority: AuthorityContext;
  readonly operationId: OperationId;
}

export async function withProviderCredential<T>(
  provider: ProviderDefinition,
  bindingsInput: Readonly<Record<string, CredentialRefId>>,
  slotKeyInput: string,
  context: ProviderCredentialUseContext,
  dependencies: CredentialAccessDependencies,
  use: (secret: string) => T | Promise<T>,
): Promise<T> {
  const bindings = normalizeProviderCredentialBindings(
    provider,
    bindingsInput,
  );
  const slotKey = slotKeyInput.trim().toLowerCase();
  const credentialRefId = bindings[slotKey];

  if (credentialRefId === undefined) {
    throw new PlatformError({
      code: "provider.credential_slot_unbound",
      category: "authorization",
      message: "Provider credential slot is not bound",
      retryable: false,
      operationId: context.operationId,
    });
  }

  return withCredentialSecret(
    dependencies,
    {
      tenantId: context.authority.tenantId,
      credentialRefId,
      providerId: provider.providerId,
      slotKey,
      purpose: "provider-dispatch",
      destinationKey: `provider:${provider.key}`,
      operationId: context.operationId,
      authorityContextId: context.authority.authorityContextId,
      correlationId: parseCanonicalId(
        "correlation",
        context.authority.correlationId,
      ),
      principalKey: principalKey(context.authority.principal),
    },
    use,
  );
}
