import {
  createCanonicalId,
  normalizeCapabilityKey,
} from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import type { ProviderDefinition } from "./model.js";
import {
  EphemeralProviderSecret,
  normalizeProviderCredentialAccessRequest,
  withResolvedProviderCredentials,
  type ProviderCredentialResolver,
} from "./credentials.js";

function provider(): ProviderDefinition {
  return {
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
        description: "Provider API key.",
      },
    ],
  };
}

describe("provider credential access", () => {
  it("binds resolution to tenant, operation, provider, purpose and destination", () => {
    const definition = provider();
    const request = normalizeProviderCredentialAccessRequest(definition, {
      tenantId: createCanonicalId("tenant"),
      operationId: createCanonicalId("operation"),
      providerId: definition.providerId,
      providerKey: "PAYMENTS",
      providerVersion: "v1",
      purpose: " tool.dispatch ",
      destinationOrigin: "https://api.example.com",
      bindings: {
        "api-key": createCanonicalId("credential-ref"),
      },
    });

    expect(request).toMatchObject({
      providerId: definition.providerId,
      providerKey: "payments",
      providerVersion: "v1",
      purpose: "tool.dispatch",
      destinationOrigin: "https://api.example.com",
    });

    expect(() =>
      normalizeProviderCredentialAccessRequest(definition, {
        ...request,
        destinationOrigin: "https://user:secret@api.example.com",
      }),
    ).toThrow(/bare HTTP\(S\) origin/u);
  });

  it("redacts ephemeral secret serialization and always releases the lease", async () => {
    const definition = provider();
    const request = normalizeProviderCredentialAccessRequest(definition, {
      tenantId: createCanonicalId("tenant"),
      operationId: createCanonicalId("operation"),
      providerId: definition.providerId,
      providerKey: definition.key,
      providerVersion: definition.version,
      purpose: "tool.dispatch",
      destinationOrigin: "https://api.example.com",
      bindings: {
        "api-key": createCanonicalId("credential-ref"),
      },
    });

    let released = 0;
    const secret = new EphemeralProviderSecret("super-secret-value");
    const resolver: ProviderCredentialResolver = {
      async acquire(received) {
        expect(received).toEqual(request);
        return {
          credentials: Object.freeze({
            "api-key": secret,
          }),
          async release() {
            released += 1;
          },
        };
      },
    };

    await expect(
      withResolvedProviderCredentials(resolver, request, async (credentials) => {
        expect(credentials["api-key"]?.reveal()).toBe("super-secret-value");
        expect(String(credentials["api-key"])).toBe("[REDACTED]");
        expect(JSON.stringify(credentials)).not.toContain("super-secret-value");
        throw new Error("adapter failed");
      }),
    ).rejects.toThrow(/adapter failed/u);

    expect(released).toBe(1);
  });
});
