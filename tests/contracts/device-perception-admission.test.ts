import { describe, expect, it } from "vitest";
import {
  admitDeviceCapture,
  type DevicePerceptionEnvelope,
} from "../../packages/perception/src/device-capture-admission.js";

const envelope: DevicePerceptionEnvelope = {
  perceptionEventId: "event_0199f0a0-0000-7000-8000-000000000201",
  tenantId: "tenant_0199f0a0-0000-7000-8000-000000000202",
  deviceId: "device_0199f0a0-0000-7000-8000-000000000203",
  sourceId: "android-device-runtime",
  subject: {
    userId: "user_0199f0a0-0000-7000-8000-000000000204",
    relationshipId: "relationship_0199f0a0-0000-7000-8000-000000000205",
    characterId: "character_0199f0a0-0000-7000-8000-000000000206",
  },
  permission: {
    authorityContextId: "authority-context_0199f0a0-0000-7000-8000-000000000207",
    basis: "device-permission",
    revision: 2,
    purposes: ["conversation"],
  },
  privacy: {
    scope: "relationship",
    retention: "session",
    memoryPromotion: "forbidden",
  },
  captureId: "capture-001",
  observedAt: "2026-10-06T10:00:00.000Z",
  receivedAt: "2026-10-06T10:00:01.000Z",
};

describe("device perception admission", () => {
  it("normalizes microphone capture without embedding raw audio", () => {
    const event = admitDeviceCapture({
      envelope,
      capture: {
        kind: "microphone",
        contentRef: "media://audio/capture-001",
        mediaType: "audio/pcm",
        durationMilliseconds: 4_500,
        sampleRateHz: 24_000,
        channels: 1,
      },
    });

    expect(event).toMatchObject({
      kind: "microphone",
      source: {
        kind: "device",
        deviceId: envelope.deviceId,
      },
      permission: { basis: "device-permission" },
      payload: {
        mediaType: "audio/pcm",
        contentRef: "media://audio/capture-001",
        inlineText: null,
        attributes: {
          durationMilliseconds: "4500",
          sampleRateHz: "24000",
          channels: "1",
        },
      },
    });
  });

  it("normalizes camera capture with bounded dimensions and facing", () => {
    const event = admitDeviceCapture({
      envelope: { ...envelope, captureId: "photo-1" },
      capture: {
        kind: "camera",
        contentRef: "media://image/photo-1",
        mediaType: "image/jpeg",
        widthPixels: 1920,
        heightPixels: 1080,
        facing: "rear",
      },
    });

    expect(event.payload.attributes).toEqual({
      widthPixels: "1920",
      heightPixels: "1080",
      facing: "rear",
    });
  });

  it("requires duration and frame rate for screen video capture", () => {
    expect(() =>
      admitDeviceCapture({
        envelope,
        capture: {
          kind: "screen",
          contentRef: "media://screen/1",
          mediaType: "video/webm",
          widthPixels: 1080,
          heightPixels: 1920,
          durationMilliseconds: null,
          frameRate: null,
        },
      }),
    ).toThrow("requires durationMilliseconds and frameRate");
  });

  it("rejects video-only metadata on a screen image capture", () => {
    expect(() =>
      admitDeviceCapture({
        envelope,
        capture: {
          kind: "screen",
          contentRef: "media://screen/shot",
          mediaType: "image/png",
          widthPixels: 1080,
          heightPixels: 1920,
          durationMilliseconds: 1000,
          frameRate: 30,
        },
      }),
    ).toThrow("must not include durationMilliseconds or frameRate");
  });

  it("rejects oversized dimensions and implausible audio metadata", () => {
    expect(() =>
      admitDeviceCapture({
        envelope,
        capture: {
          kind: "camera",
          contentRef: "media://image/huge",
          mediaType: "image/png",
          widthPixels: 20_000,
          heightPixels: 1080,
          facing: "front",
        },
      }),
    ).toThrow("widthPixels");

    expect(() =>
      admitDeviceCapture({
        envelope,
        capture: {
          kind: "microphone",
          contentRef: "media://audio/bad",
          mediaType: "audio/wav",
          durationMilliseconds: 500,
          sampleRateHz: 1_000,
          channels: 1,
        },
      }),
    ).toThrow("sampleRateHz");
  });

  it("requires canonical device-permission evidence and does not accept relationship policy as a substitute", () => {
    expect(() =>
      admitDeviceCapture({
        envelope: {
          ...envelope,
          permission: {
            ...envelope.permission,
            basis: "relationship-policy",
          },
        },
        capture: {
          kind: "microphone",
          contentRef: "media://audio/2",
          mediaType: "audio/wav",
          durationMilliseconds: 500,
          sampleRateHz: 16_000,
          channels: 1,
        },
      }),
    ).toThrow("requires device-permission evidence");
  });

  it("builds deterministic device capture dedupe identity", () => {
    const a = admitDeviceCapture({
      envelope,
      capture: {
        kind: "camera",
        contentRef: "media://image/a",
        mediaType: "image/jpeg",
        widthPixels: 100,
        heightPixels: 100,
        facing: "front",
      },
    });
    const b = admitDeviceCapture({
      envelope,
      capture: {
        kind: "camera",
        contentRef: "media://image/b",
        mediaType: "image/jpeg",
        widthPixels: 200,
        heightPixels: 200,
        facing: "front",
      },
    });

    expect(a.dedupeKey).toBe(b.dedupeKey);
    expect(a.dedupeKey).toContain(envelope.captureId);
  });
});
