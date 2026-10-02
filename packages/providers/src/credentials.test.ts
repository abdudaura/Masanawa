import {
  createCanonicalId,
  normalizeCapabilityKey,
  toInstant,
} from "@masanawa/contracts";
import {
  createAuthorityContext,
  type CredentialAccessAuditRecord,
} from "@masanawa/security";
import { describe, expect, it } from "vitest";
import {
  normalizeProviderCredentialBindings,
  withProviderCredential,
} from "./credentials.js";
import type { ProviderDefinition } from "./model.js";

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
        description: null,
      },
    ],
  };
}

describe("provider credential access", () => {
  it("keeps public bindings as CredentialRefIds and resolves only at the adapter callback", async () => {
    const definition = provider();
    const tenantId = createCanonicalId("tenant");
    const credentialRefId = createCanonicalId("credential-ref");
    const operationId = createCanonicalId("operation");
    const authority = createAuthorityContext({
      tenantId,
      principal: {
        kind: "system",
        systemKind: "provider-adapter-test",
      },
      scopes: [],
      capabilities: [normalizeCapabilityKey("payments.charge")],
      resourceScope: {},
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });
    const bindings = normalizeProviderCredentialBindings(
      definition,
      { "api-key": credentialRefId },
    );
    const audits: CredentialAccessAuditRecord[] = [];
    let closed = false;

    expect(bindings).toEqual({ "api-key": credentialRefId });
    expect(JSON.stringify(bindings)).not.toContain("provider-secret");

    const result = await withProviderCredential(
      definition,
      bindings,
      "api-key",
      { authority, operationId },
      {
        refs: {
          async load(requestTenantId, requestCredentialRefId) {
            expect(requestTenantId).toBe(tenantId);
            expect(requestCredentialRefId).toBe(credentialRefId);
            return {
              credentialRefId,
              tenantId,
              providerId: definition.providerId,
              slotKey: "api-key",
              purpose: "provider-dispatch",
              destinationKey: "provider:payments",
              vaultLocator: "vault://payments/api-key",
              generation: 4,
              state: "active",
              createdAt: toInstant("2026-10-02T10:00:00Z"),
              revokedAt: null,
            };
          },
        },
        vault: {
          async open(input) {
            expect(input).toEqual({
              vaultLocator: "vault://payments/api-key",
              generation: 4,
            });
            return {
              async withSecret(use) {
                return use("provider-secret");
              },
              close() {
                closed = true;
              },
            };
          },
        },
        audit: {
          async record(entry) {
            audits.push(entry);
          },
        },
      },
      async (secret) => {
        expect(secret).toBe("provider-secret");
        return "adapter-call-complete";
      },
    );

    expect(result).toBe("adapter-call-complete");
    expect(closed).toBe(true);
    expect(audits[0]).toMatchObject({
      tenantId,
      credentialRefId,
      providerId: definition.providerId,
      slotKey: "api-key",
      purpose: "provider-dispatch",
      destinationKey: "provider:payments",
      operationId,
      authorityContextId: authority.authorityContextId,
      correlationId: authority.correlationId,
      principalKey: "system:provider-adapter-test",
      outcome: "granted",
    });
    expect(JSON.stringify(audits)).not.toContain("provider-secret");
  });

  it("fails before resolution when the requested provider slot is not bound", async () => {
    const definition = provider();
    const tenantId = createCanonicalId("tenant");
    const authority = createAuthorityContext({
      tenantId,
      principal: { kind: "system", systemKind: "provider-adapter-test" },
      scopes: [],
      capabilities: [],
      resourceScope: {},
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    await expect(
      withProviderCredential(
        definition,
        { "api-key": createCanonicalId("credential-ref") },
        "different-slot",
        {
          authority,
          operationId: createCanonicalId("operation"),
        },
        {
          refs: {
            async load() {
              throw new Error("must not resolve");
            },
          },
          vault: {
            async open() {
              throw new Error("must not open");
            },
          },
          audit: {
            async record() {
              throw new Error("must not audit an invalid local slot request");
            },
          },
        },
        () => "never",
      ),
    ).rejects.toMatchObject({
      code: "provider.credential_slot_unbound",
      category: "authorization",
    });
  });
});
