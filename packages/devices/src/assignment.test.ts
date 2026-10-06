import { describe, expect, it } from "vitest";
import type { DeviceCapabilitySnapshot } from "./capability-model.js";
import type { Device } from "./device-model.js";
import {
  createCharacterDeviceAssignment,
  evaluateCharacterDeviceCapability,
  sameCharacterDeviceAssignment,
  transitionCharacterDeviceAssignment,
} from "./assignment.js";

const tenantId = "tenant_00000000-0000-7000-8000-000000000001" as never;
const characterId =
  "character_00000000-0000-7000-8000-000000000002" as never;
const deviceId = "device_00000000-0000-7000-8000-000000000003" as never;
const t0 = "2026-10-06T10:00:00.000Z" as never;

function device(overrides: Partial<Device> = {}): Device {
  return {
    tenantId,
    deviceId,
    enrollmentFingerprint: "fingerprint",
    metadata: {
      deviceClass: "android-agent-phone",
      platform: "android",
      platformVersion: "12",
      model: "test",
      appVersion: "1",
    },
    state: "active",
    revision: 2,
    registeredAt: "2026-10-06T09:00:00.000Z" as never,
    updatedAt: t0,
    pairedAt: t0,
    ...overrides,
  };
}

function snapshot(
  readiness: "ready" | "degraded" | "unavailable" = "ready",
  health: "healthy" | "degraded" | "unavailable" = "healthy",
): DeviceCapabilitySnapshot {
  return {
    tenantId,
    deviceId,
    generation: 4,
    capabilities: [
      {
        key: "telephony.call.place",
        readiness,
        reason: readiness === "ready" ? null : "network constraint",
        observedAt: "2026-10-06T10:05:00.000Z" as never,
      },
    ],
    health: {
      tenantId,
      deviceId,
      state: health,
      reason: health === "healthy" ? null : "device constraint",
      observedAt: "2026-10-06T10:05:00.000Z" as never,
    },
    healthStale: false,
  };
}

function assignment() {
  return createCharacterDeviceAssignment({
    device: device(),
    characterId,
    role: "primary",
    policy: {
      allowedCapabilityKeys: ["telephony.call.place"],
      allowDegradedCapability: false,
      allowDegradedDeviceHealth: false,
    },
    validFrom: t0,
    validUntil: "2026-10-07T10:00:00.000Z" as never,
    createdAt: t0,
  });
}

describe("Character Device assignment", () => {
  it("binds Character identity to an active Device without deriving capabilities from metadata", () => {
    const value = assignment();
    expect(value).toMatchObject({
      tenantId,
      characterId,
      deviceId,
      role: "primary",
      state: "active",
      revision: 1,
    });
    expect(value.policy.allowedCapabilityKeys).toEqual([
      "telephony.call.place",
    ]);
  });

  it("authorizes only an explicitly granted currently-ready capability", () => {
    expect(
      evaluateCharacterDeviceCapability({
        assignment: assignment(),
        device: device(),
        snapshot: snapshot(),
        characterId,
        capabilityKey: "TELEPHONY.CALL.PLACE",
        at: "2026-10-06T10:10:00.000Z" as never,
      }),
    ).toEqual({
      allowed: true,
      reason: "allowed",
      capabilityKey: "telephony.call.place",
    });
  });

  it("does not infer an ungranted capability from Android/device metadata", () => {
    expect(
      evaluateCharacterDeviceCapability({
        assignment: assignment(),
        device: device(),
        snapshot: snapshot(),
        characterId,
        capabilityKey: "sms.send",
        at: "2026-10-06T10:10:00.000Z" as never,
      }).reason,
    ).toBe("capability-not-granted");
  });

  it("fails closed for degraded capability/health unless the assignment policy explicitly allows them", () => {
    expect(
      evaluateCharacterDeviceCapability({
        assignment: assignment(),
        device: device(),
        snapshot: snapshot("degraded"),
        characterId,
        capabilityKey: "telephony.call.place",
        at: "2026-10-06T10:10:00.000Z" as never,
      }).reason,
    ).toBe("capability-degraded");

    expect(
      evaluateCharacterDeviceCapability({
        assignment: assignment(),
        device: device(),
        snapshot: snapshot("ready", "degraded"),
        characterId,
        capabilityKey: "telephony.call.place",
        at: "2026-10-06T10:10:00.000Z" as never,
      }).reason,
    ).toBe("device-health-degraded");
  });

  it("rejects stale/missing health before granting device execution", () => {
    expect(
      evaluateCharacterDeviceCapability({
        assignment: assignment(),
        device: device(),
        snapshot: { ...snapshot(), healthStale: true },
        characterId,
        capabilityKey: "telephony.call.place",
        at: "2026-10-06T10:10:00.000Z" as never,
      }).reason,
    ).toBe("device-health-stale");

    expect(
      evaluateCharacterDeviceCapability({
        assignment: assignment(),
        device: device(),
        snapshot: { ...snapshot(), health: null },
        characterId,
        capabilityKey: "telephony.call.place",
        at: "2026-10-06T10:10:00.000Z" as never,
      }).reason,
    ).toBe("device-health-missing");
  });

  it("suspends/reactivates with revision custody and makes revocation terminal", () => {
    const suspended = transitionCharacterDeviceAssignment({
      assignment: assignment(),
      expectedRevision: 1,
      state: "suspended",
      changedAt: "2026-10-06T10:20:00.000Z" as never,
    });
    expect(suspended.revision).toBe(2);
    const active = transitionCharacterDeviceAssignment({
      assignment: suspended,
      expectedRevision: 2,
      state: "active",
      changedAt: "2026-10-06T10:21:00.000Z" as never,
    });
    const revoked = transitionCharacterDeviceAssignment({
      assignment: active,
      expectedRevision: 3,
      state: "revoked",
      changedAt: "2026-10-06T10:22:00.000Z" as never,
    });
    expect(() =>
      transitionCharacterDeviceAssignment({
        assignment: revoked,
        expectedRevision: 4,
        state: "active",
        changedAt: "2026-10-06T10:23:00.000Z" as never,
      }),
    ).toThrow("terminal");
  });

  it("enforces assignment validity and exact Character/Device/Tenant scope", () => {
    expect(
      evaluateCharacterDeviceCapability({
        assignment: assignment(),
        device: device(),
        snapshot: snapshot(),
        characterId,
        capabilityKey: "telephony.call.place",
        at: "2026-10-08T10:00:00.000Z" as never,
      }).reason,
    ).toBe("outside-validity-window");

    expect(
      evaluateCharacterDeviceCapability({
        assignment: assignment(),
        device: device(),
        snapshot: {
          ...snapshot(),
          deviceId: "device_00000000-0000-7000-8000-000000000999" as never,
        },
        characterId,
        capabilityKey: "telephony.call.place",
        at: "2026-10-06T10:10:00.000Z" as never,
      }).reason,
    ).toBe("scope-mismatch");
  });

  it("lets a Device be replaced without changing Character identity", () => {
    const original = assignment();
    const replacementDeviceId =
      "device_00000000-0000-7000-8000-000000000004" as never;
    const replacement = createCharacterDeviceAssignment({
      device: device({ deviceId: replacementDeviceId }),
      characterId,
      role: "primary",
      policy: original.policy,
      validFrom: t0,
      validUntil: null,
      createdAt: t0,
    });
    expect(replacement.characterId).toBe(original.characterId);
    expect(replacement.deviceId).not.toBe(original.deviceId);
    expect(sameCharacterDeviceAssignment(original, replacement)).toBe(false);
  });
});
