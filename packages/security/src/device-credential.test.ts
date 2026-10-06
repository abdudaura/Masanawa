import { describe, expect, it } from "vitest";
import { CredentialSecret } from "./credentials.js";
import {
  issueDeviceOperationalCredential,
  rotateDeviceOperationalCredential,
  verifyDeviceOperationalCredential,
  revokeDeviceOperationalCredential,
} from "./device-credential.js";

const tenantId = "tenant_00000000-0000-7000-8000-000000000001" as never;
const deviceId = "device_00000000-0000-7000-8000-000000000002" as never;
const credentialId =
  "device-credential_00000000-0000-7000-8000-000000000003" as never;
const replacementId =
  "device-credential_00000000-0000-7000-8000-000000000004" as never;
const issuedAt = "2026-10-06T10:00:00.000Z" as never;
const knownSecret = CredentialSecret.fromString(
  "test-only-device-secret-material-that-is-long-enough",
);

describe("Device operational credentials", () => {
  it("issues hash-only persisted state while exposing secret through the redacted secret wrapper", () => {
    const issued = issueDeviceOperationalCredential({
      tenantId,
      deviceCredentialId: credentialId,
      deviceId,
      generation: 1,
      issuedAt,
      secret: knownSecret,
    });

    expect(issued.credential).toMatchObject({
      tenantId,
      deviceCredentialId: credentialId,
      deviceId,
      generation: 1,
      state: "active",
    });
    expect(issued.credential.secretHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(issued.secret)).toBe('"[REDACTED]"');
    expect(JSON.stringify(issued.credential)).not.toContain(
      "test-only-device-secret-material",
    );
  });

  it("verifies current secret into canonical device Principal + device-key evidence", () => {
    const issued = issueDeviceOperationalCredential({
      tenantId,
      deviceCredentialId: credentialId,
      deviceId,
      generation: 7,
      issuedAt,
      expiresAt: "2026-10-07T10:00:00.000Z" as never,
      secret: knownSecret,
    });

    const verified = verifyDeviceOperationalCredential({
      credential: issued.credential,
      presentedSecret: knownSecret,
      expectedTenantId: tenantId,
      expectedDeviceId: deviceId,
      currentGeneration: 7,
      at: "2026-10-06T10:05:00.000Z" as never,
    });

    expect(verified.principal).toEqual({ kind: "device", deviceId });
    expect(verified.evidence).toMatchObject({
      method: "device-key",
      strength: "strong",
      subject: deviceId,
    });
    expect(verified.evidence).not.toHaveProperty("characterId");
    expect(verified.evidence).not.toHaveProperty("operationId");
  });

  it("fails closed for a wrong secret, wrong scope, stale generation, revocation and expiry", () => {
    const issued = issueDeviceOperationalCredential({
      tenantId,
      deviceCredentialId: credentialId,
      deviceId,
      generation: 2,
      issuedAt,
      expiresAt: "2026-10-06T11:00:00.000Z" as never,
      secret: knownSecret,
    });

    expect(() =>
      verifyDeviceOperationalCredential({
        credential: issued.credential,
        presentedSecret: CredentialSecret.fromString("wrong-secret"),
        expectedTenantId: tenantId,
        expectedDeviceId: deviceId,
        currentGeneration: 2,
        at: "2026-10-06T10:10:00.000Z" as never,
      }),
    ).toThrow("invalid");

    expect(() =>
      verifyDeviceOperationalCredential({
        credential: issued.credential,
        presentedSecret: knownSecret,
        expectedTenantId:
          "tenant_00000000-0000-7000-8000-000000000999" as never,
        expectedDeviceId: deviceId,
        currentGeneration: 2,
        at: "2026-10-06T10:10:00.000Z" as never,
      }),
    ).toThrow("scope");

    expect(() =>
      verifyDeviceOperationalCredential({
        credential: issued.credential,
        presentedSecret: knownSecret,
        expectedTenantId: tenantId,
        expectedDeviceId: deviceId,
        currentGeneration: 3,
        at: "2026-10-06T10:10:00.000Z" as never,
      }),
    ).toThrow("rotated");

    const revoked = revokeDeviceOperationalCredential({
      credential: issued.credential,
      expectedGeneration: 2,
      revokedAt: "2026-10-06T10:20:00.000Z" as never,
    });
    expect(() =>
      verifyDeviceOperationalCredential({
        credential: revoked,
        presentedSecret: knownSecret,
        expectedTenantId: tenantId,
        expectedDeviceId: deviceId,
        currentGeneration: 2,
        at: "2026-10-06T10:30:00.000Z" as never,
      }),
    ).toThrow("revoked");

    expect(() =>
      verifyDeviceOperationalCredential({
        credential: issued.credential,
        presentedSecret: knownSecret,
        expectedTenantId: tenantId,
        expectedDeviceId: deviceId,
        currentGeneration: 2,
        at: "2026-10-06T11:00:00.000Z" as never,
      }),
    ).toThrow("expired");
  });

  it("rotates atomically as revoked old generation plus active replacement generation", () => {
    const current = issueDeviceOperationalCredential({
      tenantId,
      deviceCredentialId: credentialId,
      deviceId,
      generation: 4,
      issuedAt,
      secret: knownSecret,
    }).credential;
    const replacementSecret = CredentialSecret.fromString(
      "replacement-test-only-secret-material",
    );
    const rotated = rotateDeviceOperationalCredential({
      current,
      expectedGeneration: 4,
      replacementCredentialId: replacementId,
      rotatedAt: "2026-10-06T10:30:00.000Z" as never,
      replacementSecret,
    });

    expect(rotated.revoked).toMatchObject({
      state: "revoked",
      generation: 4,
    });
    expect(rotated.replacement).toMatchObject({
      state: "active",
      generation: 5,
      deviceCredentialId: replacementId,
      deviceId,
    });
    expect(rotated.replacement.secretHash).not.toBe(current.secretHash);
  });

  it("rejects stale rotation/revocation and invalid credential lifetimes", () => {
    const current = issueDeviceOperationalCredential({
      tenantId,
      deviceCredentialId: credentialId,
      deviceId,
      generation: 4,
      issuedAt,
      secret: knownSecret,
    }).credential;

    expect(() =>
      revokeDeviceOperationalCredential({
        credential: current,
        expectedGeneration: 3,
        revokedAt: "2026-10-06T10:30:00.000Z" as never,
      }),
    ).toThrow("stale");

    expect(() =>
      rotateDeviceOperationalCredential({
        current,
        expectedGeneration: 3,
        replacementCredentialId: replacementId,
        rotatedAt: "2026-10-06T10:30:00.000Z" as never,
      }),
    ).toThrow("stale");

    expect(() =>
      issueDeviceOperationalCredential({
        tenantId,
        deviceCredentialId: credentialId,
        deviceId,
        generation: 1,
        issuedAt,
        expiresAt: issuedAt,
        secret: knownSecret,
      }),
    ).toThrow("expiry");
  });
});
