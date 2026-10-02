import type {
  OperationId,
  TenantId,
} from "@masanawa/contracts";
import {
  resolveCredentialSecret,
  type CredentialMaterialSource,
  type CredentialSecret,
} from "@masanawa/security";
import type {
  ProviderCredentialBindings,
} from "./credentials.js";
import type { ProviderDefinition } from "./model.js";

export type ResolvedProviderCredentials = Readonly<
  Record<string, CredentialSecret>
>;

export async function resolveProviderCredentialBindings(
  source: CredentialMaterialSource,
  input: {
    readonly tenantId: TenantId;
    readonly operationId: OperationId;
    readonly provider: ProviderDefinition;
    readonly bindings: ProviderCredentialBindings;
  },
): Promise<ResolvedProviderCredentials> {
  const slots = new Map(
    input.provider.credentialSlots.map((slot) => [slot.key, slot]),
  );
  const resolved: Record<string, CredentialSecret> = {};

  for (const [slotKey, credentialRefId] of Object.entries(input.bindings)) {
    if (!slots.has(slotKey)) {
      throw new TypeError(
        `credential binding references unknown provider slot: ${slotKey}`,
      );
    }
    resolved[slotKey] = await resolveCredentialSecret(source, {
      tenantId: input.tenantId,
      credentialRefId,
      providerId: input.provider.providerId,
      operationId: input.operationId,
      slotKey,
    });
  }

  for (const slot of input.provider.credentialSlots) {
    if (slot.required && !(slot.key in resolved)) {
      throw new TypeError(
        `required provider credential slot is unresolved: ${slot.key}`,
      );
    }
  }

  return Object.freeze(resolved);
}
