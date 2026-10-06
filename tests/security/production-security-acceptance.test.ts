import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "../../packages/contracts/src/index.js";
import {
  assertCurrentAuthority,
  createAuthenticationEvidence,
  createAuthorityContext,
  CredentialSecret,
  intersectCapabilities,
  issueServiceCredential,
  verifyServiceCredential,
} from "../../packages/security/src/index.js";

describe("Task 145 production security acceptance", () => {
  it("never lets delegated/requested capabilities exceed the parent authority", () => {
    expect(
      intersectCapabilities(
        ["tools.read", "tools.execute"],
        ["tools.execute", "admin.superuser", "tools.execute"],
      ),
    ).toEqual(["tools.execute"]);
  });

  it("rejects stale and explicitly revoked AuthorityContext snapshots", async () => {
    const tenantId = createCanonicalId("tenant");
    const context = createAuthorityContext({
      tenantId,
      principal: {
        kind: "user",
        userId: createCanonicalId("user"),
      },
      scopes: ["relationship"],
      capabilities: ["agents.session.read"],
      resourceScope: {},
      policyRevision: "policy-7",
      approvalIds: [],
      delegationChain: [],
      issuedAt: toInstant("2026-10-06T10:00:00Z"),
      expiresAt: toInstant("2026-10-06T12:00:00Z"),
      requestId: "request-security-001",
      correlationId: "correlation-security-001",
    });

    await expect(
      assertCurrentAuthority(
        context,
        {
          getPolicyRevision() {
            return "policy-8";
          },
        },
        toInstant("2026-10-06T11:00:00Z"),
      ),
    ).rejects.toMatchObject({ code: "authority.stale_policy" });

    await expect(
      assertCurrentAuthority(
        context,
        {
          getPolicyRevision() {
            return "policy-7";
          },
          isRevoked() {
            return true;
          },
        },
        toInstant("2026-10-06T11:00:00Z"),
      ),
    ).rejects.toMatchObject({ code: "authority.revoked" });
  });

  it("rejects cross-tenant and cross-audience service credential replay", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const issuer = createCanonicalId("service");
    const audience = createCanonicalId("service");
    const otherAudience = createCanonicalId("service");
    const tenantA = createCanonicalId("tenant");
    const tenantB = createCanonicalId("tenant");

    const token = issueServiceCredential({
      issuer,
      audience,
      tenantId: tenantA,
      capabilities: ["gateway.internal.call"],
      credentialGeneration: 1,
      issuedAt: toInstant("2026-10-06T10:00:00Z"),
      expiresAt: toInstant("2026-10-06T10:04:00Z"),
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      keyId: "security-key-1",
      privateKey,
    });

    const keySource = {
      resolve() {
        return {
          publicKey,
          credentialGeneration: 1,
          active: true,
        };
      },
    };

    await expect(
      verifyServiceCredential(token, {
        expectedAudience: audience,
        expectedTenantId: tenantB,
        keySource,
        at: toInstant("2026-10-06T10:02:00Z"),
      }),
    ).rejects.toMatchObject({
      code: "service-credential.wrong_tenant",
    });

    await expect(
      verifyServiceCredential(token, {
        expectedAudience: otherAudience,
        expectedTenantId: tenantA,
        keySource,
        at: toInstant("2026-10-06T10:02:00Z"),
      }),
    ).rejects.toMatchObject({
      code: "service-credential.wrong_audience",
    });
  });

  it("treats credential-generation rotation as revocation of older signed tokens", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const issuer = createCanonicalId("service");
    const audience = createCanonicalId("service");

    const token = issueServiceCredential({
      issuer,
      audience,
      capabilities: ["worker.dispatch"],
      credentialGeneration: 4,
      issuedAt: toInstant("2026-10-06T10:00:00Z"),
      expiresAt: toInstant("2026-10-06T10:04:00Z"),
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      keyId: "security-key-rotate",
      privateKey,
    });

    await expect(
      verifyServiceCredential(token, {
        expectedAudience: audience,
        requiredCapabilities: ["worker.dispatch"],
        keySource: {
          resolve() {
            return {
              publicKey,
              credentialGeneration: 5,
              active: true,
            };
          },
        },
        at: toInstant("2026-10-06T10:02:00Z"),
      }),
    ).rejects.toMatchObject({
      code: "service-credential.stale_generation",
    });
  });

  it("rejects authentication evidence fields containing control-character injection", () => {
    expect(() =>
      createAuthenticationEvidence({
        method: "oauth",
        issuer: "trusted-issuer\nforged-header: yes",
        subject: "subject-1",
        strength: "strong",
        authenticatedAt: toInstant("2026-10-06T10:00:00Z"),
      }),
    ).toThrow("issuer is invalid");

    expect(() =>
      createAuthenticationEvidence({
        method: "oauth",
        issuer: "trusted-issuer",
        subject: "subject-1",
        strength: "strong",
        authenticatedAt: toInstant("2026-10-06T10:00:00Z"),
        metadata: {
          source: "ok\0hidden",
        },
      }),
    ).toThrow("metadata value is invalid");
  });

  it("never leaks secret canaries through stringification or JSON serialization", () => {
    const canary = "production-secret-canary-never-expose";
    const secret = CredentialSecret.fromString(canary);

    expect(secret.use((value) => value)).toBe(canary);
    expect(String(secret)).toBe("[REDACTED]");
    expect(JSON.stringify(secret)).toBe('"[REDACTED]"');

    const serialized = JSON.stringify({
      provider: "example",
      credential: secret,
      nested: { secret },
    });

    expect(serialized).toContain("[REDACTED]");
    expect(serialized).not.toContain(canary);
  });

  it("rejects service credentials that lack a required capability even when signature and tenant are valid", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const issuer = createCanonicalId("service");
    const audience = createCanonicalId("service");
    const tenantId = createCanonicalId("tenant");

    const token = issueServiceCredential({
      issuer,
      audience,
      tenantId,
      capabilities: ["read.only"],
      credentialGeneration: 1,
      issuedAt: toInstant("2026-10-06T10:00:00Z"),
      expiresAt: toInstant("2026-10-06T10:04:00Z"),
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      keyId: "security-key-capability",
      privateKey,
    });

    await expect(
      verifyServiceCredential(token, {
        expectedAudience: audience,
        expectedTenantId: tenantId,
        requiredCapabilities: ["write.consequential"],
        keySource: {
          resolve() {
            return {
              publicKey,
              credentialGeneration: 1,
              active: true,
            };
          },
        },
        at: toInstant("2026-10-06T10:02:00Z"),
      }),
    ).rejects.toMatchObject({
      code: "service-credential.insufficient_capability",
    });
  });
});
