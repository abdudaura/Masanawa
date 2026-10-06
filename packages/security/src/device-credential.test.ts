import { describe, expect, it, vi } from "vitest";
import {
  completeDeviceReconnect,
  createDeviceOperationalCredential,
  expireDeviceReconnectChallenge,
  issueDeviceReconnectChallenge,
  revokeDeviceOperationalCredential,
  rotateDeviceOperationalCredential,
  type DeviceReconnectProofVerifier,
} from "./device-credential.js";

const tenantId = "tenant_00000000-0000-7000-8000-000000000001" as never;
const deviceId = "device_00000000-0000-7000-8000-000000000002" as never;
const credentialId =
  "device-credential_00000000-0000-7000-8000-000000000003" as never;
const requestId = "request_00000000-0000-7000-8000-000000000004" as never;
const issuedAt = "2026-10-06T10:00:00.000Z" as never;
const expiresAt = "2026-11-06T10:00:00.000Z" as never;

function credential() {
  return createDeviceOperationalCredential({
    tenantId,
    deviceCredentialId: credentialId,
    deviceId,
    generation: 1,
    verificationKeyRef: "keystore:device-key:1",
    keyFingerprint: "sha256:0123456789abcdef",
    issuedAt,
    expiresAt,
  });
}

function challenge() {
  return issueDeviceReconnectChallenge({
    credential: credential(),
    requestId,
    challengeDigest: "sha256:challenge:0123456789abcdef",
    createdAt: "2026-10-06T10:05:00.000Z" as never,
    expiresAt: "2026-10-06T10:10:00.000Z" as never,
  });
}

function verifier(result = true): DeviceReconnectProofVerifier {
  return {
    verify: vi.fn(async () => result),
  };
}

describe("Device operational credential and reconnect", () => {
  it("creates a bounded active generation-bound operational credential", () => {
    expect(credential()).toMatchObject({
      tenantId,
      deviceId,
      deviceCredentialId: credentialId,
      generation: 1,
      state: "active",
      verificationKeyRef: "keystore:device-key:1",
      keyFingerprint: "sha256:0123456789abcdef",
      revision: 1,
    });
  });

  it("rotates to a new generation while terminally revoking the old credential", () => {
    const rotated = rotateDeviceOperationalCredential({
      current: credential(),
      expectedRevision: 1,
      deviceCredentialId:
        "device-credential_00000000-0000-7000-8000-000000000005" as never,
      verificationKeyRef: "keystore:device-key:2",
      keyFingerprint: "sha256:fedcba9876543210",
      rotatedAt: "2026-10-06T10:20:00.000Z" as never,
      expiresAt: "2026-12-06T10:20:00.000Z" as never,
    });
    expect(rotated.revoked.state).toBe("revoked");
    expect(rotated.revoked.revision).toBe(2);
    expect(rotated.replacement.generation).toBe(2);
    expect(rotated.replacement.deviceId).toBe(deviceId);
    expect(() =>
      revokeDeviceOperationalCredential({
        credential: rotated.revoked,
        expectedRevision: 1,
        revokedAt: "2026-10-06T10:30:00.000Z" as never,
      }),
    ).toThrow("stale");
  });

  it("binds reconnect challenge to exact Device credential generation and expiry", () => {
    expect(challenge()).toMatchObject({
      tenantId,
      deviceId,
      deviceCredentialId: credentialId,
      credentialGeneration: 1,
      requestId,
      state: "pending",
      revision: 1,
    });
    expect(() =>
      issueDeviceReconnectChallenge({
        credential: credential(),
        requestId,
        challengeDigest: "sha256:challenge:0123456789abcdef",
        createdAt: "2026-11-06T09:59:00.000Z" as never,
        expiresAt: "2026-11-06T10:01:00.000Z" as never,
      }),
    ).toThrow("cannot outlive");
  });

  it("produces canonical strong device-key authentication only after valid proof", async () => {
    const proofVerifier = verifier(true);
    const completed = await completeDeviceReconnect(
      {
        credential: credential(),
        challenge: challenge(),
        currentCredentialGeneration: 1,
        expectedChallengeRevision: 1,
        proof: "signed-proof-0123456789abcdef",
        authenticatedAt: "2026-10-06T10:06:00.000Z" as never,
      },
      proofVerifier,
    );

    expect(completed.challenge).toMatchObject({
      state: "consumed",
      revision: 2,
      consumedAt: "2026-10-06T10:06:00.000Z",
    });
    expect(completed.authentication).toMatchObject({
      method: "device-key",
      issuer: "masanawa-device-credential",
      subject: deviceId,
      strength: "strong",
    });
    expect(completed.authentication.metadata).toMatchObject({
      deviceCredentialId: credentialId,
      credentialGeneration: "1",
      reconnectRequestId: requestId,
    });
    expect(proofVerifier.verify).toHaveBeenCalledTimes(1);
    expect(completed.authentication).not.toHaveProperty("characterId");
    expect(completed.authentication).not.toHaveProperty("operationId");
  });

  it("rejects revoked or non-current credentials before cryptographic verification", async () => {
    const proofVerifier = verifier(true);
    const revoked = revokeDeviceOperationalCredential({
      credential: credential(),
      expectedRevision: 1,
      revokedAt: "2026-10-06T10:05:30.000Z" as never,
    });

    await expect(
      completeDeviceReconnect(
        {
          credential: revoked,
          challenge: challenge(),
          currentCredentialGeneration: 1,
          expectedChallengeRevision: 1,
          proof: "signed-proof-0123456789abcdef",
          authenticatedAt: "2026-10-06T10:06:00.000Z" as never,
        },
        proofVerifier,
      ),
    ).rejects.toThrow("revoked");

    await expect(
      completeDeviceReconnect(
        {
          credential: credential(),
          challenge: challenge(),
          currentCredentialGeneration: 2,
          expectedChallengeRevision: 1,
          proof: "signed-proof-0123456789abcdef",
          authenticatedAt: "2026-10-06T10:06:00.000Z" as never,
        },
        proofVerifier,
      ),
    ).rejects.toThrow("no longer current");
    expect(proofVerifier.verify).not.toHaveBeenCalled();
  });

  it("rejects credential/challenge scope substitution", async () => {
    const wrongCredential = createDeviceOperationalCredential({
      tenantId,
      deviceCredentialId:
        "device-credential_00000000-0000-7000-8000-000000000006" as never,
      deviceId,
      generation: 1,
      verificationKeyRef: "keystore:device-key:other",
      keyFingerprint: "sha256:aaaaaaaaaaaaaaaa",
      issuedAt,
      expiresAt,
    });
    await expect(
      completeDeviceReconnect(
        {
          credential: wrongCredential,
          challenge: challenge(),
          currentCredentialGeneration: 1,
          expectedChallengeRevision: 1,
          proof: "signed-proof-0123456789abcdef",
          authenticatedAt: "2026-10-06T10:06:00.000Z" as never,
        },
        verifier(true),
      ),
    ).rejects.toThrow("not bound");
  });

  it("rejects expired challenge and invalid proof without authentication evidence", async () => {
    await expect(
      completeDeviceReconnect(
        {
          credential: credential(),
          challenge: challenge(),
          currentCredentialGeneration: 1,
          expectedChallengeRevision: 1,
          proof: "signed-proof-0123456789abcdef",
          authenticatedAt: "2026-10-06T10:10:00.000Z" as never,
        },
        verifier(true),
      ),
    ).rejects.toThrow("challenge is expired");

    await expect(
      completeDeviceReconnect(
        {
          credential: credential(),
          challenge: challenge(),
          currentCredentialGeneration: 1,
          expectedChallengeRevision: 1,
          proof: "signed-proof-0123456789abcdef",
          authenticatedAt: "2026-10-06T10:06:00.000Z" as never,
        },
        verifier(false),
      ),
    ).rejects.toThrow("proof is invalid");
  });

  it("expires pending challenges with revision custody", () => {
    const expired = expireDeviceReconnectChallenge({
      challenge: challenge(),
      expectedRevision: 1,
      at: "2026-10-06T10:10:00.000Z" as never,
    });
    expect(expired).toMatchObject({ state: "expired", revision: 2 });
  });

  it("rejects consumed challenge replay", async () => {
    const first = await completeDeviceReconnect(
      {
        credential: credential(),
        challenge: challenge(),
        currentCredentialGeneration: 1,
        expectedChallengeRevision: 1,
        proof: "signed-proof-0123456789abcdef",
        authenticatedAt: "2026-10-06T10:06:00.000Z" as never,
      },
      verifier(true),
    );

    await expect(
      completeDeviceReconnect(
        {
          credential: credential(),
          challenge: first.challenge,
          currentCredentialGeneration: 1,
          expectedChallengeRevision: 2,
          proof: "signed-proof-0123456789abcdef",
          authenticatedAt: "2026-10-06T10:07:00.000Z" as never,
        },
        verifier(true),
      ),
    ).rejects.toThrow("not pending");
  });
});
