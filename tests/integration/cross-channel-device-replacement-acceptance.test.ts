import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  type CharacterId,
  type DeviceId,
  type Instant,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import {
  activateChannelBinding,
  assertChannelBindingUsable,
  createChannelAccount,
  createPendingChannelBinding,
  revokeChannelBinding,
} from "../../packages/identity/src/channel-binding.js";
import {
  createDevice,
} from "../../packages/devices/src/pairing.js";
import {
  createDeviceCapabilityPublication,
  createDeviceCapabilitySnapshot,
  createDeviceHealthFact,
} from "../../packages/devices/src/capability.js";
import {
  createCharacterDeviceAssignment,
  evaluateCharacterDeviceCapability,
  transitionCharacterDeviceAssignment,
} from "../../packages/devices/src/assignment.js";
import {
  completeDeviceReconnect,
  createDeviceOperationalCredential,
  issueDeviceReconnectChallenge,
  revokeDeviceOperationalCredential,
} from "../../packages/security/src/device-credential.js";

const at = (value: string) => value as Instant;

function activeDevice(input: {
  tenantId: TenantId;
  deviceId: DeviceId;
  model: string;
  registeredAt: string;
}) {
  return createDevice({
    tenantId: input.tenantId,
    deviceId: input.deviceId,
    enrollmentFingerprint: `enrollment:${input.model}`,
    metadata: {
      deviceClass: "android-agent-device",
      platform: "android",
      platformVersion: "15",
      model: input.model,
      appVersion: "1.0.0",
    },
    state: "active",
    revision: 1,
    registeredAt: at(input.registeredAt),
    updatedAt: at(input.registeredAt),
    pairedAt: at(input.registeredAt),
  });
}

function readySnapshot(input: {
  tenantId: TenantId;
  deviceId: DeviceId;
  observedAt: string;
  capability?: string;
}) {
  const capability = input.capability ?? "telephony.call.place";
  const observedAt = at(input.observedAt);
  const publication = createDeviceCapabilityPublication({
    tenantId: input.tenantId,
    deviceId: input.deviceId,
    generation: 1,
    capabilities: [
      {
        key: capability,
        readiness: "ready",
        reason: null,
        observedAt,
      },
    ],
    publishedAt: observedAt,
  });
  const health = createDeviceHealthFact({
    tenantId: input.tenantId,
    deviceId: input.deviceId,
    state: "healthy",
    reason: null,
    observedAt,
  });
  return createDeviceCapabilitySnapshot({
    publication,
    health,
    at: observedAt,
    staleAfterMs: 60_000,
  });
}

function activeAssignment(input: {
  device: ReturnType<typeof activeDevice>;
  characterId: CharacterId;
  createdAt: string;
}) {
  return createCharacterDeviceAssignment({
    device: input.device,
    characterId: input.characterId,
    role: "primary",
    policy: {
      allowedCapabilityKeys: ["telephony.call.place"],
      allowDegradedCapability: false,
      allowDegradedDeviceHealth: false,
    },
    validFrom: at(input.createdAt),
    validUntil: null,
    createdAt: at(input.createdAt),
  });
}

describe("Production Task 108 cross-channel continuity and Device replacement", () => {
  it("keeps WhatsApp and Telegram continuity on one canonical User", () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");

    const whatsapp = createChannelAccount({
      tenantId,
      channelAccountId: createCanonicalId("channel-account"),
      channel: "whatsapp",
      providerAccountRef: "wa-business-001",
      createdAt: at("2026-10-06T15:00:00.000Z"),
    });
    const telegram = createChannelAccount({
      tenantId,
      channelAccountId: createCanonicalId("channel-account"),
      channel: "telegram",
      providerAccountRef: "telegram-bot-001",
      createdAt: at("2026-10-06T15:00:00.000Z"),
    });

    const waPending = createPendingChannelBinding({
      account: whatsapp,
      userId,
      externalSubjectId: "wa:+2347000000001",
      createdAt: at("2026-10-06T15:01:00.000Z"),
    });
    const tgPending = createPendingChannelBinding({
      account: telegram,
      userId,
      externalSubjectId: "tg:123456789",
      createdAt: at("2026-10-06T15:01:00.000Z"),
    });

    const waBinding = activateChannelBinding({
      account: whatsapp,
      binding: waPending,
      expectedRevision: 1,
      proof: {
        purpose: "account-link",
        method: "channel-possession-challenge",
        evidenceRef: "evidence:wa-link-001",
        verifiedAt: at("2026-10-06T15:01:30.000Z"),
      },
      activatedAt: at("2026-10-06T15:02:00.000Z"),
    });
    const tgBinding = activateChannelBinding({
      account: telegram,
      binding: tgPending,
      expectedRevision: 1,
      proof: {
        purpose: "account-link",
        method: "authenticated-cross-channel-confirmation",
        evidenceRef: "evidence:tg-link-001",
        verifiedAt: at("2026-10-06T15:01:40.000Z"),
      },
      activatedAt: at("2026-10-06T15:02:00.000Z"),
    });

    expect(waBinding.userId).toBe(userId);
    expect(tgBinding.userId).toBe(userId);
    expect(waBinding.channelAccountId).not.toBe(tgBinding.channelAccountId);
    expect(waBinding.externalSubjectId).not.toBe(tgBinding.externalSubjectId);

    expect(() =>
      assertChannelBindingUsable({
        account: whatsapp,
        binding: waBinding,
        tenantId,
        externalSubjectId: "wa:+2347000000001",
      }),
    ).not.toThrow();
    expect(() =>
      assertChannelBindingUsable({
        account: telegram,
        binding: tgBinding,
        tenantId,
        externalSubjectId: "tg:123456789",
      }),
    ).not.toThrow();

    const revokedWa = revokeChannelBinding({
      binding: waBinding,
      expectedRevision: waBinding.revision,
      revokedAt: at("2026-10-06T15:05:00.000Z"),
    });

    expect(() =>
      assertChannelBindingUsable({
        account: whatsapp,
        binding: revokedWa,
        tenantId,
        externalSubjectId: "wa:+2347000000001",
      }),
    ).toThrow("not active");

    expect(() =>
      assertChannelBindingUsable({
        account: telegram,
        binding: tgBinding,
        tenantId,
        externalSubjectId: "tg:123456789",
      }),
    ).not.toThrow();
    expect(tgBinding.userId).toBe(userId);
  });

  it("moves one Character to a replacement Device and revokes the old execution path", async () => {
    const tenantId = createCanonicalId("tenant");
    const characterId = createCanonicalId("character");

    const oldDevice = activeDevice({
      tenantId,
      deviceId: createCanonicalId("device"),
      model: "Old handset",
      registeredAt: "2026-10-06T15:10:00.000Z",
    });
    const replacementDevice = activeDevice({
      tenantId,
      deviceId: createCanonicalId("device"),
      model: "Replacement handset",
      registeredAt: "2026-10-06T15:20:00.000Z",
    });

    const oldAssignment = activeAssignment({
      device: oldDevice,
      characterId,
      createdAt: "2026-10-06T15:10:00.000Z",
    });
    const replacementAssignment = activeAssignment({
      device: replacementDevice,
      characterId,
      createdAt: "2026-10-06T15:20:00.000Z",
    });

    const oldSnapshot = readySnapshot({
      tenantId,
      deviceId: oldDevice.deviceId,
      observedAt: "2026-10-06T15:21:00.000Z",
    });
    const replacementSnapshot = readySnapshot({
      tenantId,
      deviceId: replacementDevice.deviceId,
      observedAt: "2026-10-06T15:21:00.000Z",
    });

    expect(
      evaluateCharacterDeviceCapability({
        assignment: oldAssignment,
        device: oldDevice,
        snapshot: oldSnapshot,
        characterId,
        capabilityKey: "telephony.call.place",
        at: at("2026-10-06T15:21:30.000Z"),
      }),
    ).toMatchObject({ allowed: true, reason: "allowed" });

    const revokedOldAssignment = transitionCharacterDeviceAssignment({
      assignment: oldAssignment,
      expectedRevision: oldAssignment.revision,
      state: "revoked",
      changedAt: at("2026-10-06T15:22:00.000Z"),
    });

    expect(
      evaluateCharacterDeviceCapability({
        assignment: revokedOldAssignment,
        device: oldDevice,
        snapshot: oldSnapshot,
        characterId,
        capabilityKey: "telephony.call.place",
        at: at("2026-10-06T15:22:30.000Z"),
      }),
    ).toMatchObject({
      allowed: false,
      reason: "assignment-inactive",
    });

    expect(replacementAssignment.characterId).toBe(characterId);
    expect(replacementAssignment.deviceId).not.toBe(oldAssignment.deviceId);
    expect(
      evaluateCharacterDeviceCapability({
        assignment: replacementAssignment,
        device: replacementDevice,
        snapshot: replacementSnapshot,
        characterId,
        capabilityKey: "telephony.call.place",
        at: at("2026-10-06T15:22:30.000Z"),
      }),
    ).toMatchObject({ allowed: true, reason: "allowed" });

    const oldCredential = createDeviceOperationalCredential({
      tenantId,
      deviceCredentialId: createCanonicalId("device-credential"),
      deviceId: oldDevice.deviceId,
      generation: 1,
      verificationKeyRef: "keystore://old-device/key-1",
      keyFingerprint: "old-device-fingerprint-0001",
      issuedAt: at("2026-10-06T15:10:00.000Z"),
      expiresAt: at("2026-10-07T15:10:00.000Z"),
    });
    const oldChallenge = issueDeviceReconnectChallenge({
      credential: oldCredential,
      requestId: createCanonicalId("request"),
      challengeDigest: "old-device-challenge-digest-0001",
      createdAt: at("2026-10-06T15:21:00.000Z"),
      expiresAt: at("2026-10-06T15:26:00.000Z"),
    });
    const revokedOldCredential = revokeDeviceOperationalCredential({
      credential: oldCredential,
      expectedRevision: oldCredential.revision,
      revokedAt: at("2026-10-06T15:22:00.000Z"),
    });

    await expect(
      completeDeviceReconnect(
        {
          credential: revokedOldCredential,
          challenge: oldChallenge,
          currentCredentialGeneration: revokedOldCredential.generation,
          expectedChallengeRevision: oldChallenge.revision,
          proof: "proof-for-old-device-0001",
          authenticatedAt: at("2026-10-06T15:22:30.000Z"),
        },
        { async verify() { return true; } },
      ),
    ).rejects.toThrow("revoked");

    const replacementCredential = createDeviceOperationalCredential({
      tenantId,
      deviceCredentialId: createCanonicalId("device-credential"),
      deviceId: replacementDevice.deviceId,
      generation: 1,
      verificationKeyRef: "keystore://replacement-device/key-1",
      keyFingerprint: "replacement-fingerprint-0001",
      issuedAt: at("2026-10-06T15:20:00.000Z"),
      expiresAt: at("2026-10-07T15:20:00.000Z"),
    });
    const replacementChallenge = issueDeviceReconnectChallenge({
      credential: replacementCredential,
      requestId: createCanonicalId("request"),
      challengeDigest: "replacement-challenge-digest-0001",
      createdAt: at("2026-10-06T15:22:00.000Z"),
      expiresAt: at("2026-10-06T15:27:00.000Z"),
    });
    const replacementReconnect = await completeDeviceReconnect(
      {
        credential: replacementCredential,
        challenge: replacementChallenge,
        currentCredentialGeneration: replacementCredential.generation,
        expectedChallengeRevision: replacementChallenge.revision,
        proof: "proof-for-replacement-device-0001",
        authenticatedAt: at("2026-10-06T15:22:30.000Z"),
      },
      {
        async verify(input) {
          return (
            input.deviceId === replacementDevice.deviceId &&
            input.deviceCredentialId === replacementCredential.deviceCredentialId
          );
        },
      },
    );

    expect(replacementReconnect.challenge.state).toBe("consumed");
    expect(replacementReconnect.authentication).toMatchObject({
      method: "device-key",
      subject: replacementDevice.deviceId,
      strength: "strong",
    });
  });

  it("fails closed on cross-Tenant and cross-Device substitution", () => {
    const tenantId = createCanonicalId("tenant");
    const otherTenantId = createCanonicalId("tenant");
    const characterId = createCanonicalId("character");
    const device = activeDevice({
      tenantId,
      deviceId: createCanonicalId("device"),
      model: "Primary handset",
      registeredAt: "2026-10-06T15:30:00.000Z",
    });
    const assignment = activeAssignment({
      device,
      characterId,
      createdAt: "2026-10-06T15:30:00.000Z",
    });

    const foreignDevice = activeDevice({
      tenantId: otherTenantId,
      deviceId: createCanonicalId("device"),
      model: "Foreign handset",
      registeredAt: "2026-10-06T15:30:00.000Z",
    });
    const foreignSnapshot = readySnapshot({
      tenantId: otherTenantId,
      deviceId: foreignDevice.deviceId,
      observedAt: "2026-10-06T15:31:00.000Z",
    });

    expect(
      evaluateCharacterDeviceCapability({
        assignment,
        device: foreignDevice,
        snapshot: foreignSnapshot,
        characterId,
        capabilityKey: "telephony.call.place",
        at: at("2026-10-06T15:31:30.000Z"),
      }),
    ).toMatchObject({
      allowed: false,
      reason: "scope-mismatch",
    });

    const whatsapp = createChannelAccount({
      tenantId,
      channelAccountId: createCanonicalId("channel-account"),
      channel: "whatsapp",
      providerAccountRef: "wa-business-cross-tenant",
      createdAt: at("2026-10-06T15:30:00.000Z"),
    });
    const binding = activateChannelBinding({
      account: whatsapp,
      binding: createPendingChannelBinding({
        account: whatsapp,
        userId: createCanonicalId("user"),
        externalSubjectId: "wa:+2347000000009",
        createdAt: at("2026-10-06T15:30:10.000Z"),
      }),
      expectedRevision: 1,
      proof: {
        purpose: "account-link",
        method: "channel-possession-challenge",
        evidenceRef: "evidence:cross-tenant-link",
        verifiedAt: at("2026-10-06T15:30:20.000Z"),
      },
      activatedAt: at("2026-10-06T15:30:30.000Z"),
    });

    expect(() =>
      assertChannelBindingUsable({
        account: whatsapp,
        binding,
        tenantId: otherTenantId,
        externalSubjectId: binding.externalSubjectId,
      }),
    ).toThrow("different tenant");
  });
});
