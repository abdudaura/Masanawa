import { describe, expect, it } from "vitest";
import {
  admitSensorPerception,
  type SensorPerceptionEnvelope,
} from "../../packages/perception/src/sensor-admission.js";

function envelope(purpose: string): SensorPerceptionEnvelope {
  return {
    perceptionEventId: "event_0199f0a0-0000-7000-8000-000000000301",
    tenantId: "tenant_0199f0a0-0000-7000-8000-000000000302",
    deviceId: "device_0199f0a0-0000-7000-8000-000000000303",
    sourceId: "android-sensors",
    subject: {
      userId: "user_0199f0a0-0000-7000-8000-000000000304",
      relationshipId: "relationship_0199f0a0-0000-7000-8000-000000000305",
      characterId: "character_0199f0a0-0000-7000-8000-000000000306",
    },
    permission: {
      authorityContextId: "authority-context_0199f0a0-0000-7000-8000-000000000307",
      basis: "device-permission",
      revision: 2,
      purposes: [purpose],
    },
    privacy: {
      scope: "relationship",
      retention: "session",
      memoryPromotion: "forbidden",
    },
    upstreamEventId: "sensor-event-1",
    observedAt: "2026-10-06T10:00:00.000Z",
    receivedAt: "2026-10-06T10:00:01.000Z",
  };
}

describe("sensor perception admission", () => {
  it("admits notification context only with explicit notification purpose", () => {
    const event = admitSensorPerception({
      envelope: envelope("notification-context"),
      sensor: {
        kind: "notification",
        applicationId: "com.example.mail",
        title: "New message",
        body: "A bounded notification body",
      },
    });
    expect(event.kind).toBe("notification");
    expect(event.payload.attributes.applicationId).toBe("com.example.mail");

    expect(() =>
      admitSensorPerception({
        envelope: envelope("conversation"),
        sensor: {
          kind: "notification",
          applicationId: "com.example.mail",
          title: "New message",
          body: "Body",
        },
      }),
    ).toThrow("notification-context");
  });

  it("admits bounded device state and rejects invalid battery percentages", () => {
    const event = admitSensorPerception({
      envelope: envelope("device-state"),
      sensor: {
        kind: "device-state",
        batteryPercent: 42,
        charging: true,
        network: "wifi",
      },
    });
    expect(event).toMatchObject({
      kind: "device-state",
      payload: {
        attributes: {
          batteryPercent: "42",
          charging: "true",
          network: "wifi",
        },
      },
    });

    expect(() =>
      admitSensorPerception({
        envelope: envelope("device-state"),
        sensor: {
          kind: "device-state",
          batteryPercent: 101,
          charging: false,
          network: "offline",
        },
      }),
    ).toThrow("batteryPercent");
  });

  it("coarsens coarse location coordinates before projection", () => {
    const event = admitSensorPerception({
      envelope: envelope("location"),
      sensor: {
        kind: "location",
        precision: "coarse",
        latitude: 51.589123,
        longitude: 4.775987,
        accuracyMeters: 860,
      },
    });

    expect(event.payload.attributes).toMatchObject({
      precision: "coarse",
      latitude: "51.59",
      longitude: "4.78",
      accuracyMeters: "860",
    });
    expect(event.payload.inlineText).not.toContain("51.589123");
    expect(event.payload.inlineText).not.toContain("4.775987");
  });

  it("preserves bounded precise location only under private/relationship scope", () => {
    const event = admitSensorPerception({
      envelope: envelope("location"),
      sensor: {
        kind: "location",
        precision: "precise",
        latitude: 51.5891234,
        longitude: 4.7759874,
        accuracyMeters: 8.4,
      },
    });
    expect(event.payload.attributes).toMatchObject({
      precision: "precise",
      latitude: "51.589123",
      longitude: "4.775987",
      accuracyMeters: "8",
    });
  });

  it("requires device-permission evidence for all sensor events", () => {
    const base = envelope("device-state");
    expect(() =>
      admitSensorPerception({
        envelope: {
          ...base,
          permission: { ...base.permission, basis: "system-policy" },
        },
        sensor: {
          kind: "device-state",
          batteryPercent: 50,
          charging: false,
          network: "cellular",
        },
      }),
    ).toThrow("device-permission");
  });

  it("requires explicit location permission purpose", () => {
    expect(() =>
      admitSensorPerception({
        envelope: envelope("conversation"),
        sensor: {
          kind: "location",
          precision: "coarse",
          latitude: 10,
          longitude: 10,
          accuracyMeters: 1000,
        },
      }),
    ).toThrow("permission purpose: location");
  });

  it("keeps sensor dedupe stable for the same device/upstream event", () => {
    const a = admitSensorPerception({
      envelope: envelope("device-state"),
      sensor: {
        kind: "device-state",
        batteryPercent: 10,
        charging: false,
        network: "offline",
      },
    });
    const b = admitSensorPerception({
      envelope: envelope("device-state"),
      sensor: {
        kind: "device-state",
        batteryPercent: 20,
        charging: true,
        network: "wifi",
      },
    });
    expect(a.dedupeKey).toBe(b.dedupeKey);
  });
});
