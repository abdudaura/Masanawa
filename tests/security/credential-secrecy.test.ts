import {
  createCanonicalId,
  normalizeCapabilityKey,
} from "@masanawa/contracts";
import {
  resolveProviderCredentialBindings,
  type ProviderDefinition,
} from "@masanawa/providers";
import {
  CredentialSecret,
  type CredentialMaterialSource,
} from "@masanawa/security";
import { describe, expect, it } from "vitest";

describe("cross-cutting credential secrecy", () => {
  it("keeps provider credential material usable only through the explicit secret callback", async () => {
    const canary = "task056-secret-canary-do-not-log";
    const tenantId = createCanonicalId("tenant");
    const operationId = createCanonicalId("operation");
    const credentialRefId = createCanonicalId("credential-ref");
    const provider: ProviderDefinition = {
      providerId: createCanonicalId("provider"),
      key: "security-canary-provider",
      version: "v1",
      displayName: "Security Canary Provider",
      capabilities: [normalizeCapabilityKey("security.canary")],
      selectionPriority: 0,
      credentialSlots: [
        {
          key: "api-key",
          required: true,
          description: null,
        },
      ],
    };

    const source: CredentialMaterialSource = {
      async resolve(request) {
        expect(request).toMatchObject({
          tenantId,
          providerId: provider.providerId,
          operationId,
          credentialRefId,
          slotKey: "api-key",
        });
        return CredentialSecret.fromString(canary);
      },
    };

    const credentials = await resolveProviderCredentialBindings(source, {
      tenantId,
      operationId,
      provider,
      bindings: {
        "api-key": credentialRefId,
      },
    });

    expect(credentials["api-key"]?.use((value) => value)).toBe(canary);
    expect(String(credentials["api-key"])).toBe("[REDACTED]");

    const serialized = JSON.stringify({
      providerId: provider.providerId,
      credentials,
    });
    expect(serialized).toContain("[REDACTED]");
    expect(serialized).not.toContain(canary);
  });
});
