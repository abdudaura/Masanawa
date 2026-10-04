import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  createDeviceCapabilityPublication,
  createDeviceCapabilitySnapshot,
  createDeviceHealthFact,
  isDeviceHealthStale,
} from "./index.js";

const observedAt = toInstant(new Date("2026-10-04T18:00:00.000Z"));
const tenantId = createCanonicalId("tenant");
const deviceId = createCanonicalId("device");

describe("DeviceCapability contracts", () => {
  it("normalizes a complete immutable capability generation", () => {
    const input = {
      tenantId,
      deviceId,
      generation: 1,
      capabilities: [
        {
          key: "SMS.Send",
          readiness: "ready" as const,
          reason: null,
          observedAt,
        },
        {
          key: "telephony.call.place",
          readiness: "degraded" as const,
          reason: "voice_network_limited",
          observedAt,
        },
      ],
      publishedAt: observedAt,
    };
    const publication = createDeviceCapabilityPublication(input);

    input.capabilities[0]!.key = "mutated";
    expect(publication.capabilities.map((item) => item.key)).toEqual([
      "sms.send",
      "telephony.call.place",
    ]);
    expect(Object.isFrozen(publication.capabilities)).toBe(true);
  });

  it("rejects duplicate keys and unsupported readiness shapes", () => {
    expect(() =>
      createDeviceCapabilityPublication({
        tenantId,
        deviceId,
        generation: 1,
        capabilities: [
          {
            key: "sms.send",
            readiness: "ready",
            reason: null,
            observedAt,
          },
          {
            key: "SMS.Send",
            readiness: "ready",
            reason: null,
            observedAt,
          },
        ],
        publishedAt: observedAt,
      }),
    ).toThrow(/duplicate capability keys/u);

    expect(() =>
      createDeviceCapabilityPublication({
        tenantId,
        deviceId,
        generation: 1,
        capabilities: [
          {
            key: "sms.send",
            readiness: "degraded",
            reason: null,
            observedAt,
          },
        ],
        publishedAt: observedAt,
      }),
    ).toThrow(/requires a reason/u);
  });

  it("computes health staleness without inventing capabilities", () => {
    const health = createDeviceHealthFact({
      tenantId,
      deviceId,
      state: "healthy",
      reason: null,
      observedAt,
    });
    expect(
      isDeviceHealthStale(
        health,
        toInstant(new Date("2026-10-04T18:00:30.000Z")),
        60_000,
      ),
    ).toBe(false);
    expect(
      isDeviceHealthStale(
        health,
        toInstant(new Date("2026-10-04T18:02:00.000Z")),
        60_000,
      ),
    ).toBe(true);

    const publication = createDeviceCapabilityPublication({
      tenantId,
      deviceId,
      generation: 1,
      capabilities: [],
      publishedAt: observedAt,
    });
    const snapshot = createDeviceCapabilitySnapshot({
      publication,
      health,
      at: toInstant(new Date("2026-10-04T18:02:00.000Z")),
      staleAfterMs: 60_000,
    });
    expect(snapshot.healthStale).toBe(true);
    expect(snapshot.capabilities).toEqual([]);
  });
});
