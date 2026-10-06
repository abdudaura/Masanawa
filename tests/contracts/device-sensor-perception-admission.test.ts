import { describe, expect, it } from "vitest";
import { admitDeviceSensorPerception } from "../../packages/perception/src/device-sensor-admission.js";

const envelope = {
  perceptionEventId: "event_01K7SENSOR00000000000000000",
  tenantId: "tenant_01K7SENSOR00000000000000000",
  deviceId: "device_01K7SENSOR00000000000000000",
  sourceId: "android-agent-device",
  subject: {
    userId: "user_01K7SENSOR0000000000000000000",
    relationshipId: null,
    characterId: null,
  },
  permission: {
    authorityContextId: "authority-context_01K7SENSOR000000000000",
    basis: "device-permission" as const,
    revision: 3,
    purposes: ["assist-user"],
  },
  privacy: {
    scope: "user-private" as const,
    retention: "session" as const,
    memoryPromotion: "forbidden" as const,
  },
  observationId: "sensor-observation-1",
  observedAt: "2026-10-06T17:00:00.000Z",
  receivedAt: "2026-10-06T17:00:01.000Z",
};

describe("Device sensor perception admission", () => {
  it("normalizes a bounded notification observation", () => {
    const event = admitDeviceSensorPerception({
      envelope,
      observation: {
        kind: "notification",
        applicationId: "com.example.bank",
        notificationKey: "notif-42",
        title: "Payment received",
        body: "A payment notification was received.",
        category: "finance",
        ongoing: false,
      },
    });

    expect(event).toMatchObject({
      kind: "notification",
      source: {
        kind: "device",
        deviceId: envelope.deviceId,
      },
      dedupeKey: `device:${envelope.deviceId}:sensor-observation-1`,
      payload: {
        mediaType: "application/json",
        attributes: {
          applicationId: "com.example.bank",
          notificationKey: "notif-42",
          category: "finance",
          ongoing: "false",
        },
      },
    });
    expect(JSON.parse(event.payload.inlineText!)).toEqual({
      applicationId: "com.example.bank",
      notificationKey: "notif-42",
      title: "Payment received",
      body: "A payment notification was received.",
      category: "finance",
      ongoing: false,
    });
  });

  it("requires notification title or body and bounds content", () => {
    expect(() =>
      admitDeviceSensorPerception({
        envelope,
        observation: {
          kind: "notification",
          applicationId: "com.example",
          notificationKey: "n1",
          title: null,
          body: null,
          category: null,
          ongoing: false,
        },
      }),
    ).toThrow(/requires title or body/);

    expect(() =>
      admitDeviceSensorPerception({
        envelope,
        observation: {
          kind: "notification",
          applicationId: "com.example",
          notificationKey: "n1",
          title: "x".repeat(501),
          body: null,
          category: null,
          ongoing: false,
        },
      }),
    ).toThrow(/title/);
  });

  it("normalizes explicit Device-state facts without inventing capability support", () => {
    const event = admitDeviceSensorPerception({
      envelope: {
        ...envelope,
        observationId: "state-1",
      },
      observation: {
        kind: "device-state",
        batteryPercent: 58,
        charging: true,
        network: "cellular",
        metered: true,
        powerSaveMode: false,
        screenInteractive: true,
      },
    });

    expect(event.kind).toBe("device-state");
    expect(JSON.parse(event.payload.inlineText!)).toEqual({
      batteryPercent: 58,
      charging: true,
      network: "cellular",
      metered: true,
      powerSaveMode: false,
      screenInteractive: true,
    });
    expect(event.payload.attributes).toEqual({
      batteryPercent: "58",
      network: "cellular",
    });
    expect(event.payload.inlineText).not.toContain("capability");
  });

  it("requires at least one actual Device-state fact", () => {
    expect(() =>
      admitDeviceSensorPerception({
        envelope,
        observation: {
          kind: "device-state",
          batteryPercent: null,
          charging: null,
          network: null,
          metered: null,
          powerSaveMode: null,
          screenInteractive: null,
        },
      }),
    ).toThrow(/at least one observed fact/);
  });

  it("requires exact device-permission evidence for every sensor", () => {
    expect(() =>
      admitDeviceSensorPerception({
        envelope: {
          ...envelope,
          permission: {
            ...envelope.permission,
            basis: "user-action",
          },
        },
        observation: {
          kind: "device-state",
          batteryPercent: 50,
          charging: null,
          network: null,
          metered: null,
          powerSaveMode: null,
          screenInteractive: null,
        },
      }),
    ).toThrow(/device-permission/);
  });

  it("admits precise location only as non-durable user-private perception", () => {
    const event = admitDeviceSensorPerception({
      envelope: {
        ...envelope,
        observationId: "location-precise-1",
      },
      observation: {
        kind: "location",
        permissionPrecision: "precise",
        latitude: 11.8333,
        longitude: 13.15,
        accuracyMeters: 8,
        altitudeMeters: 320,
        speedMetersPerSecond: 1.5,
      },
    });

    expect(event).toMatchObject({
      kind: "location",
      privacy: {
        scope: "user-private",
        retention: "session",
        memoryPromotion: "forbidden",
      },
      payload: {
        attributes: {
          precision: "precise",
          accuracyMeters: "8",
        },
      },
    });
    expect(JSON.parse(event.payload.inlineText!)).toMatchObject({
      permissionPrecision: "precise",
      latitude: 11.8333,
      longitude: 13.15,
      accuracyMeters: 8,
      altitudeMeters: 320,
      speedMetersPerSecond: 1.5,
    });
  });

  it("reduces coarse location precision and strips altitude/speed", () => {
    const event = admitDeviceSensorPerception({
      envelope: {
        ...envelope,
        observationId: "location-coarse-1",
      },
      observation: {
        kind: "location",
        permissionPrecision: "coarse",
        latitude: 11.83331234,
        longitude: 13.15781234,
        accuracyMeters: 850,
        altitudeMeters: 320,
        speedMetersPerSecond: 12,
      },
    });

    expect(JSON.parse(event.payload.inlineText!)).toEqual({
      permissionPrecision: "coarse",
      latitude: 11.83,
      longitude: 13.16,
      accuracyMeters: 850,
      altitudeMeters: null,
      speedMetersPerSecond: null,
    });
  });

  it("rejects falsely precise data under coarse permission", () => {
    expect(() =>
      admitDeviceSensorPerception({
        envelope,
        observation: {
          kind: "location",
          permissionPrecision: "coarse",
          latitude: 11.8333,
          longitude: 13.15,
          accuracyMeters: 10,
          altitudeMeters: null,
          speedMetersPerSecond: null,
        },
      }),
    ).toThrow(/unexpectedly precise/);
  });

  it("forbids durable, relationship-scoped or memory-promotable location", () => {
    const location = {
      kind: "location" as const,
      permissionPrecision: "precise" as const,
      latitude: 11.8,
      longitude: 13.1,
      accuracyMeters: 20,
      altitudeMeters: null,
      speedMetersPerSecond: null,
    };

    expect(() =>
      admitDeviceSensorPerception({
        envelope: {
          ...envelope,
          privacy: {
            scope: "relationship",
            retention: "session",
            memoryPromotion: "forbidden",
          },
          subject: {
            userId: envelope.subject.userId,
            relationshipId: "relationship_01K7SENSOR0000000000000",
            characterId: "character_01K7SENSOR000000000000000",
          },
        },
        observation: location,
      }),
    ).toThrow(/user-private/);

    expect(() =>
      admitDeviceSensorPerception({
        envelope: {
          ...envelope,
          privacy: {
            scope: "user-private",
            retention: "durable",
            memoryPromotion: "review-required",
          },
        },
        observation: location,
      }),
    ).toThrow(/must not use durable retention/);
  });

  it("keeps dedupe identity stable for the exact Device observation", () => {
    const first = admitDeviceSensorPerception({
      envelope,
      observation: {
        kind: "device-state",
        batteryPercent: 50,
        charging: null,
        network: null,
        metered: null,
        powerSaveMode: null,
        screenInteractive: null,
      },
    });
    const replay = admitDeviceSensorPerception({
      envelope,
      observation: {
        kind: "device-state",
        batteryPercent: 50,
        charging: null,
        network: null,
        metered: null,
        powerSaveMode: null,
        screenInteractive: null,
      },
    });

    expect(replay.dedupeKey).toBe(first.dedupeKey);
    expect(replay.payload.inlineText).toBe(first.payload.inlineText);
  });
});
