import { describe, expect, it } from "vitest";
import {
  assertPublicProjectionSafe,
  assertTenantScopedPublicRecords,
  auditPublicProjection,
} from "../../packages/security/src/public-projection-audit.js";

const tenantA = "tenant_018f6b2e-7c00-7501-8000-000000000001" as never;
const tenantB = "tenant_018f6b2e-7c00-7502-8000-000000000002" as never;

describe("Task 145 public projection secret-leak audit", () => {
  it("accepts safe credential metadata, hashes and token-count telemetry", () => {
    const projection = {
      tenantId: tenantA,
      provider: {
        credentialRefId:
          "credential-ref_018f6b2e-7c00-7503-8000-000000000003",
        credentialFingerprint: "sha256:abcd",
        credentialStatus: "active",
        credentialProvider: "gemini",
        rotatedAt: "2026-10-06T12:00:00.000Z",
      },
      usage: {
        inputTokens: 200,
        outputTokens: 75,
        maxTokens: 1000,
        tokenCount: 275,
      },
      receiptHash:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      externalUrl: "https://provider.example/resource/123",
    };

    expect(auditPublicProjection(projection)).toEqual([]);
    expect(() => assertPublicProjectionSafe(projection)).not.toThrow();
  });

  it.each([
    ["accessToken", "abcd"],
    ["refresh_token", "abcd"],
    ["clientSecret", "abcd"],
    ["private_key", "abcd"],
    ["credentialCiphertext", "abcd"],
    ["rawCredential", "abcd"],
    ["webhookSecret", "abcd"],
    ["authorization", "Basic x"],
    ["cookie", "session=x"],
  ])("flags forbidden credential-bearing field %s", (key, value) => {
    const projection = {
      tenantId: tenantA,
      nested: {
        deeper: {
          [key]: value,
        },
      },
    };

    const leaks = auditPublicProjection(projection);
    expect(leaks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining(key),
          kind: "forbidden-field",
        }),
      ]),
    );
    expect(() => assertPublicProjectionSafe(projection)).toThrow(
      "credential-bearing field name",
    );
  });

  it.each([
    [
      "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
      "private-key material",
    ],
    [
      "Bearer abcdefghijklmnopqrstuvwxyz0123456789",
      "bearer token material",
    ],
    [
      "ghp_abcdefghijklmnopqrstuvwxyz0123456789AB",
      "GitHub token material",
    ],
    [
      "github_pat_abcdefghijklmnopqrstuvwxyz_0123456789AB",
      "GitHub fine-grained token material",
    ],
    ["AKIAABCDEFGHIJKLMNOP", "AWS access-key material"],
    ["sk-abcdefghijklmnopqrstuvwxyz0123456789", "provider API-key material"],
    [
      "eyJabcdefghij.abcdefghij12345.abcdefghij67890",
      "JWT-like token material",
    ],
  ])("flags high-confidence secret text: %s", (value, reason) => {
    const leaks = auditPublicProjection({
      tenantId: tenantA,
      message: value,
    });

    expect(leaks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.message",
          kind: "secret-value",
          reason,
        }),
      ]),
    );
  });

  it("flags credentials embedded inside otherwise-valid HTTPS URLs", () => {
    const leaks = auditPublicProjection({
      tenantId: tenantA,
      callback: "https://user:password@example.com/hook",
    });

    expect(leaks).toEqual([
      {
        path: "$.callback",
        kind: "credential-url",
        reason: "URL contains embedded credentials",
      },
    ]);
  });

  it("rejects cyclic and non-plain public structures instead of recursing indefinitely", () => {
    const cyclic: Record<string, unknown> = {
      tenantId: tenantA,
    };
    cyclic.self = cyclic;

    expect(auditPublicProjection(cyclic)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.self",
          kind: "invalid-structure",
          reason: "public projection contains a cycle",
        }),
      ]),
    );

    expect(auditPublicProjection({
      tenantId: tenantA,
      created: new Date(),
    })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.created",
          kind: "invalid-structure",
        }),
      ]),
    );
  });

  it("enforces depth and node bounds on attacker-controlled output", () => {
    let deep: Record<string, unknown> = {};
    const root = deep;
    for (let index = 0; index < 20; index += 1) {
      const next: Record<string, unknown> = {};
      deep.next = next;
      deep = next;
    }

    const depthLeaks = auditPublicProjection(root, {
      maxDepth: 5,
      maxNodes: 100,
    });
    expect(depthLeaks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "traversal-limit",
          reason: "public projection exceeds depth bound",
        }),
      ]),
    );

    const nodeLeaks = auditPublicProjection(
      Array.from({ length: 20 }, (_, index) => ({ index })),
      {
        maxDepth: 10,
        maxNodes: 5,
      },
    );
    expect(nodeLeaks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "traversal-limit",
          reason: "public projection exceeds node bound",
        }),
      ]),
    );
  });

  it("rejects non-finite numeric values and non-JSON primitives", () => {
    expect(auditPublicProjection({
      tenantId: tenantA,
      latency: Number.POSITIVE_INFINITY,
      optional: undefined,
    })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.latency",
          kind: "invalid-structure",
        }),
        expect.objectContaining({
          path: "$.optional",
          kind: "invalid-structure",
        }),
      ]),
    );
  });
});

describe("Task 145 tenant-isolation projection guard", () => {
  it("returns same-tenant records unchanged", () => {
    const records = Object.freeze([
      Object.freeze({ tenantId: tenantA, id: "a" }),
      Object.freeze({ tenantId: tenantA, id: "b" }),
    ]);

    expect(assertTenantScopedPublicRecords(tenantA, records)).toBe(records);
  });

  it("fails closed when one record belongs to another Tenant", () => {
    expect(() =>
      assertTenantScopedPublicRecords(tenantA, [
        { tenantId: tenantA, id: "safe" },
        { tenantId: tenantB, id: "leak" },
      ]),
    ).toThrow("Cross-tenant public projection");
  });

  it("rejects malformed expected or record Tenant IDs", () => {
    expect(() =>
      assertTenantScopedPublicRecords("tenant-invalid" as never, []),
    ).toThrow();

    expect(() =>
      assertTenantScopedPublicRecords(tenantA, [
        { tenantId: "tenant-invalid" as never, id: "bad" },
      ]),
    ).toThrow();
  });

  it("bounds record batches before iterating them", () => {
    const records = Array.from({ length: 100_001 }, () => ({
      tenantId: tenantA,
    }));
    expect(() =>
      assertTenantScopedPublicRecords(tenantA, records),
    ).toThrow("batch is invalid");
  });
});
