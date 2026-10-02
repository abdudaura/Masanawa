import {
  createCanonicalId,
  normalizeCapabilityKey,
} from "@masanawa/contracts";
import { CredentialSecret } from "@masanawa/security";
import { describe, expect, it } from "vitest";
import {
  resolveProviderCredentialBindings,
  type ProviderDefinition,
} from "./index.js";

describe("provider credential resolution", () => {
  it("resolves refs with tenant/provider/operation/slot scope and redacts serialization", async () => {
    const tenantId = createCanonicalId("tenant");
    const operationId = createCanonicalId("operation");
    const provider: ProviderDefinition = {
      providerId: createCanonicalId("provider"),
      key: "payments",
      version: "v1",
      displayName: "Payments",
      capabilities: [normalizeCapabilityKey("payments.charge")],
      selectionPriority: 1,
      credentialSlots: [
        {
          key: "api-key",
          required: true,
          description: null,
        },
      ],
    };
    const credentialRefId = createCanonicalId("credential-ref");
    const requests: unknown[] = [];

    const resolved = await resolveProviderCredentialBindings(
      {
        async resolve(request) {
          requests.push(request);
          return CredentialSecret.fromString("super-secret-value");
        },
      },
      {
        tenantId,
        operationId,
        provider,
        bindings: {
          "api-key": credentialRefId,
        },
      },
    );

    expect(requests).toEqual([
      {
        tenantId,
        operationId,
        providerId: provider.providerId,
        credentialRefId,
        slotKey: "api-key",
      },
    ]);

    expect(JSON.stringify(resolved)).toBe('{"api-key":"[REDACTED]"}');
    expect(resolved["api-key"]?.toString()).toBe("[REDACTED]");
    expect(
      resolved["api-key"]?.use((value) => value.length),
    ).toBe("super-secret-value".length);
  });

  it("fails closed when a required credential cannot be resolved", async () => {
    const provider: ProviderDefinition = {
      providerId: createCanonicalId("provider"),
      key: "payments",
      version: "v1",
      displayName: "Payments",
      capabilities: [normalizeCapabilityKey("payments.charge")],
      selectionPriority: 1,
      credentialSlots: [
        {
          key: "api-key",
          required: true,
          description: null,
        },
      ],
    };

    await expect(
      resolveProviderCredentialBindings(
        {
          async resolve() {
            return null;
          },
        },
        {
          tenantId: createCanonicalId("tenant"),
          operationId: createCanonicalId("operation"),
          provider,
          bindings: {
            "api-key": createCanonicalId("credential-ref"),
          },
        },
      ),
    ).rejects.toThrow(/unavailable for requested scope/u);
  });
});
