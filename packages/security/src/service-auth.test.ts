import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  issueServiceCredential,
  verifyServiceCredential,
  type ServiceCredentialKeySource,
} from "./service-auth.js";

function fixture() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const issuer = createCanonicalId("service");
  const audience = createCanonicalId("service");
  const tenantId = createCanonicalId("tenant");
  const requestId = createCanonicalId("request");
  const correlationId = createCanonicalId("correlation");
  const keyId = "service-key-1";
  const generation = 4;

  const keySource: ServiceCredentialKeySource = {
    resolve(serviceId, resolvedKeyId) {
      if (serviceId !== issuer || resolvedKeyId !== keyId) {
        return null;
      }
      return {
        publicKey,
        credentialGeneration: generation,
        active: true,
      };
    },
  };

  const token = issueServiceCredential({
    keyId,
    privateKey,
    issuer,
    audience,
    tenantId,
    capabilities: ["workflow.dispatch", "events.publish"],
    credentialGeneration: generation,
    issuedAt: toInstant("2026-10-01T18:00:00Z"),
    expiresAt: toInstant("2026-10-01T18:04:00Z"),
    requestId,
    correlationId,
  });

  return {
    issuer,
    audience,
    tenantId,
    requestId,
    correlationId,
    keyId,
    generation,
    privateKey,
    publicKey,
    keySource,
    token,
  };
}

describe("service workload credentials", () => {
  it("verifies a short-lived audience-bound capability credential as a Service principal", async () => {
    const data = fixture();

    const verified = await verifyServiceCredential(data.token, {
      expectedAudience: data.audience,
      expectedTenantId: data.tenantId,
      requiredCapabilities: ["workflow.dispatch"],
      keySource: data.keySource,
      at: toInstant("2026-10-01T18:02:00Z"),
      clockSkewMs: 0,
    });

    expect(verified.principal).toEqual({
      kind: "service",
      serviceId: data.issuer,
    });
    expect(verified.claims.requestId).toBe(data.requestId);
    expect(verified.claims.correlationId).toBe(data.correlationId);
    expect(verified.claims.capabilities).toEqual([
      "events.publish",
      "workflow.dispatch",
    ]);
    expect(verified).not.toHaveProperty("userId");
  });

  it("rejects a credential presented to the wrong audience", async () => {
    const data = fixture();

    await expect(
      verifyServiceCredential(data.token, {
        expectedAudience: createCanonicalId("service"),
        keySource: data.keySource,
        at: toInstant("2026-10-01T18:02:00Z"),
        clockSkewMs: 0,
      }),
    ).rejects.toMatchObject({
      code: "service-credential.wrong_audience",
      category: "authorization",
    });
  });

  it("rejects missing capabilities without expanding the grant", async () => {
    const data = fixture();

    await expect(
      verifyServiceCredential(data.token, {
        expectedAudience: data.audience,
        requiredCapabilities: ["secrets.read"],
        keySource: data.keySource,
        at: toInstant("2026-10-01T18:02:00Z"),
        clockSkewMs: 0,
      }),
    ).rejects.toMatchObject({
      code: "service-credential.insufficient_capability",
      category: "authorization",
    });
  });

  it("rejects expired and rotated credentials", async () => {
    const data = fixture();

    await expect(
      verifyServiceCredential(data.token, {
        expectedAudience: data.audience,
        keySource: data.keySource,
        at: toInstant("2026-10-01T18:05:00Z"),
        clockSkewMs: 0,
      }),
    ).rejects.toMatchObject({
      code: "service-credential.expired",
      category: "authentication",
    });

    await expect(
      verifyServiceCredential(data.token, {
        expectedAudience: data.audience,
        keySource: {
          resolve: () => ({
            publicKey: data.publicKey,
            credentialGeneration: data.generation + 1,
            active: true,
          }),
        },
        at: toInstant("2026-10-01T18:02:00Z"),
        clockSkewMs: 0,
      }),
    ).rejects.toMatchObject({
      code: "service-credential.stale_generation",
      category: "authentication",
    });
  });

  it("rejects tampering even when the altered payload remains valid JSON", async () => {
    const data = fixture();
    const segments = data.token.split(".");
    const payload = JSON.parse(
      Buffer.from(segments[2]!, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    payload.audience = createCanonicalId("service");
    segments[2] = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );

    await expect(
      verifyServiceCredential(segments.join("."), {
        expectedAudience: data.audience,
        keySource: data.keySource,
        at: toInstant("2026-10-01T18:02:00Z"),
        clockSkewMs: 0,
      }),
    ).rejects.toMatchObject({
      code: "service-credential.invalid_signature",
      category: "authentication",
    });
  });
});
