import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  createDevice,
  createDevicePairingChallenge,
  hashPairingSecret,
  isPairingChallengeCurrent,
  issuePairingSecret,
  verifyPairingSecret,
} from "./index.js";

const registeredAt = toInstant(new Date("2026-10-04T18:00:00.000Z"));

describe("Device registration and pairing contracts", () => {
  it("normalizes and freezes Device registration metadata", () => {
    const metadata = {
      deviceClass: "Android_Phone",
      platform: "ANDROID",
      platformVersion: "12",
      model: "TECNO Pop 7",
      appVersion: "1.0.0",
    };
    const device = createDevice({
      tenantId: createCanonicalId("tenant"),
      deviceId: createCanonicalId("device"),
      enrollmentFingerprint: "hardware-enrollment-fingerprint",
      metadata,
      state: "pending-pairing",
      revision: 1,
      registeredAt,
      updatedAt: registeredAt,
      pairedAt: null,
    });

    metadata.model = "mutated";
    expect(device.metadata).toEqual({
      deviceClass: "android_phone",
      platform: "android",
      platformVersion: "12",
      model: "TECNO Pop 7",
      appVersion: "1.0.0",
    });
    expect(Object.isFrozen(device)).toBe(true);
    expect(Object.isFrozen(device.metadata)).toBe(true);
  });

  it("issues high-entropy one-time secrets and persists only deterministic hashes", () => {
    const first = issuePairingSecret();
    const second = issuePairingSecret();

    expect(first.secret).not.toBe(second.secret);
    expect(first.secret.length).toBeGreaterThanOrEqual(32);
    expect(first.secretHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.secretHash).toBe(hashPairingSecret(first.secret));
    expect(verifyPairingSecret(first.secret, first.secretHash)).toBe(true);
    expect(verifyPairingSecret(second.secret, first.secretHash)).toBe(false);
    expect(verifyPairingSecret("short", first.secretHash)).toBe(false);
  });

  it("enforces bounded pairing challenge lifetime and one-time state shape", () => {
    const secret = issuePairingSecret();
    const pairingRequestId = createCanonicalId("request");
    const deviceId = createCanonicalId("device");
    const tenantId = createCanonicalId("tenant");
    const expiresAt = toInstant(
      new Date(new Date(registeredAt).getTime() + 5 * 60_000),
    );

    const challenge = createDevicePairingChallenge({
      tenantId,
      pairingRequestId,
      deviceId,
      secretHash: secret.secretHash,
      state: "pending",
      createdAt: registeredAt,
      expiresAt,
      consumedAt: null,
    });
    expect(
      isPairingChallengeCurrent(
        challenge,
        toInstant(new Date(new Date(registeredAt).getTime() + 1_000)),
      ),
    ).toBe(true);
    expect(isPairingChallengeCurrent(challenge, expiresAt)).toBe(false);

    expect(() =>
      createDevicePairingChallenge({
        ...challenge,
        expiresAt: toInstant(
          new Date(new Date(registeredAt).getTime() + 10_000),
        ),
      }),
    ).toThrow(/lifetime/u);

    expect(() =>
      createDevicePairingChallenge({
        ...challenge,
        state: "consumed",
        consumedAt: null,
      }),
    ).toThrow(/consumedAt/u);
  });

  it("requires lifecycle-consistent pairing timestamps", () => {
    const base = {
      tenantId: createCanonicalId("tenant"),
      deviceId: createCanonicalId("device"),
      enrollmentFingerprint: "enrollment",
      metadata: {
        deviceClass: "android_phone",
        platform: "android",
        platformVersion: "12",
        model: "Device",
        appVersion: "1",
      },
      revision: 1,
      registeredAt,
      updatedAt: registeredAt,
    };

    expect(() =>
      createDevice({
        ...base,
        state: "active",
        pairedAt: null,
      }),
    ).toThrow(/requires pairedAt/u);

    expect(() =>
      createDevice({
        ...base,
        state: "pending-pairing",
        pairedAt: registeredAt,
      }),
    ).toThrow(/cannot have pairedAt/u);
  });
});
