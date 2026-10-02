import {
  createCanonicalId,
  toInstant,
  type CredentialRefId,
  type TenantId,
} from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import {
  withCredentialSecret,
  type CredentialAccessAuditRecord,
  type CredentialRefRecord,
  type CredentialSecretLease,
} from "./credential.js";

function fixtureRecord(
  overrides: Partial<CredentialRefRecord> = {},
): CredentialRefRecord {
  return {
    credentialRefId: createCanonicalId("credential-ref"),
    tenantId: createCanonicalId("tenant"),
    providerId: createCanonicalId("provider"),
    slotKey: "api-key",
    purpose: "provider-dispatch",
    destinationKey: "payments-api",
    vaultLocator: "vault://providers/payments/api-key",
    generation: 1,
    state: "active",
    createdAt: toInstant("2026-10-02T10:00:00Z"),
    revokedAt: null,
    ...overrides,
  };
}

function requestFor(record: CredentialRefRecord) {
  return {
    tenantId: record.tenantId,
    credentialRefId: record.credentialRefId,
    providerId: record.providerId,
    slotKey: record.slotKey,
    purpose: record.purpose,
    destinationKey: record.destinationKey,
    operationId: createCanonicalId("operation"),
    authorityContextId: createCanonicalId("authority-context"),
    correlationId: createCanonicalId("correlation"),
    principalKey: "system:credential-test",
  } as const;
}

describe("CredentialRef resolution", () => {
  it("exposes secret material only inside the scoped lease callback and closes it", async () => {
    const record = fixtureRecord();
    const audits: CredentialAccessAuditRecord[] = [];
    let closed = false;
    let secretObserved = "";

    const lease: CredentialSecretLease = {
      async withSecret(use) {
        return use("super-secret-provider-token");
      },
      close() {
        closed = true;
      },
    };

    const result = await withCredentialSecret(
      {
        refs: {
          async load(tenantId, credentialRefId) {
            return tenantId === record.tenantId &&
              credentialRefId === record.credentialRefId
              ? record
              : null;
          },
        },
        vault: {
          async open(input) {
            expect(input).toEqual({
              vaultLocator: record.vaultLocator,
              generation: 1,
            });
            return lease;
          },
        },
        audit: {
          async record(entry) {
            audits.push(entry);
          },
        },
      },
      requestFor(record),
      async (secret) => {
        secretObserved = secret;
        return "provider-result";
      },
    );

    expect(result).toBe("provider-result");
    expect(secretObserved).toBe("super-secret-provider-token");
    expect(closed).toBe(true);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      credentialRefId: record.credentialRefId,
      providerId: record.providerId,
      slotKey: "api-key",
      purpose: "provider-dispatch",
      destinationKey: "payments-api",
      outcome: "granted",
      reasonCode: "credential-access-granted",
    });
    expect(JSON.stringify(audits)).not.toContain(
      "super-secret-provider-token",
    );
    expect(JSON.stringify(record)).not.toContain(
      "super-secret-provider-token",
    );
  });

  it("fails closed on cross-tenant and destination scope mismatch before vault access", async () => {
    const record = fixtureRecord();
    const audits: CredentialAccessAuditRecord[] = [];
    let vaultOpened = 0;

    const dependencies = {
      refs: {
        async load(
          tenantId: TenantId,
          credentialRefId: CredentialRefId,
        ) {
          // Repository APIs themselves are tenant-scoped.
          return tenantId === record.tenantId &&
            credentialRefId === record.credentialRefId
            ? record
            : null;
        },
      },
      vault: {
        async open() {
          vaultOpened += 1;
          return null;
        },
      },
      audit: {
        async record(entry: CredentialAccessAuditRecord) {
          audits.push(entry);
        },
      },
    };

    await expect(
      withCredentialSecret(
        dependencies,
        {
          ...requestFor(record),
          tenantId: createCanonicalId("tenant"),
        },
        () => "never",
      ),
    ).rejects.toMatchObject({
      code: "credential-ref.not_found",
      category: "not-found",
    });
    expect(vaultOpened).toBe(0);

    await expect(
      withCredentialSecret(
        dependencies,
        {
          ...requestFor(record),
          destinationKey: "different-api",
        },
        () => "never",
      ),
    ).rejects.toMatchObject({
      code: "credential-ref.scope_mismatch",
      category: "authorization",
    });
    expect(vaultOpened).toBe(0);
    expect(audits.map((entry) => entry.outcome)).toEqual([
      "denied",
      "denied",
    ]);
  });

  it("blocks revoked refs and unresolved secrets visibly", async () => {
    const revoked = fixtureRecord({
      state: "revoked",
      revokedAt: toInstant("2026-10-02T10:05:00Z"),
    });

    await expect(
      withCredentialSecret(
        {
          refs: {
            async load() {
              return revoked;
            },
          },
          vault: {
            async open() {
              throw new Error("must not open revoked ref");
            },
          },
          audit: {
            async record() {},
          },
        },
        requestFor(revoked),
        () => "never",
      ),
    ).rejects.toMatchObject({
      code: "credential-ref.revoked",
      category: "authorization",
    });

    const active = fixtureRecord();
    const audits: CredentialAccessAuditRecord[] = [];
    await expect(
      withCredentialSecret(
        {
          refs: {
            async load() {
              return active;
            },
          },
          vault: {
            async open() {
              return null;
            },
          },
          audit: {
            async record(entry) {
              audits.push(entry);
            },
          },
        },
        requestFor(active),
        () => "never",
      ),
    ).rejects.toMatchObject({
      code: "credential-ref.secret_unresolved",
      category: "unavailable",
    });
    expect(audits.at(-1)).toMatchObject({
      outcome: "unavailable",
      reasonCode: "credential-secret-unresolved",
    });
  });

  it("closes a vault lease even when audit or adapter use fails", async () => {
    const record = fixtureRecord();
    let auditFailureClosed = false;
    const auditFailureLease: CredentialSecretLease = {
      async withSecret() {
        throw new Error("secret callback must not run");
      },
      close() {
        auditFailureClosed = true;
      },
    };

    await expect(
      withCredentialSecret(
        {
          refs: {
            async load() {
              return record;
            },
          },
          vault: {
            async open() {
              return auditFailureLease;
            },
          },
          audit: {
            async record() {
              throw new Error("audit unavailable");
            },
          },
        },
        requestFor(record),
        () => "never",
      ),
    ).rejects.toThrow(/audit unavailable/u);
    expect(auditFailureClosed).toBe(true);

    let useFailureClosed = false;
    const useFailureLease: CredentialSecretLease = {
      async withSecret(use) {
        return use("ephemeral-token");
      },
      close() {
        useFailureClosed = true;
      },
    };
    await expect(
      withCredentialSecret(
        {
          refs: {
            async load() {
              return record;
            },
          },
          vault: {
            async open() {
              return useFailureLease;
            },
          },
          audit: {
            async record() {},
          },
        },
        requestFor(record),
        () => {
          throw new Error("provider failed");
        },
      ),
    ).rejects.toThrow(/provider failed/u);
    expect(useFailureClosed).toBe(true);
  });
});
